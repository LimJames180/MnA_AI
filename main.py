from fastapi import FastAPI, UploadFile, File, HTTPException, Depends
from openai import OpenAI
from sqlalchemy.orm import Session
import openai
import pytesseract
from PIL import Image
import os
import PyPDF2
from database import SessionLocal, Base, engine, Log
from starlette.middleware.cors import CORSMiddleware

# Initialize FastAPI
app = FastAPI()

# Set OpenAI API key
api_key = os.getenv("OPENAI_API_KEY")
client = OpenAI(api_key=api_key)
if not api_key:
    raise RuntimeError("The environment variable OPENAI_API_KEY is not set.")

# Directory for temporary file storage
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize database
Base.metadata.create_all(bind=engine)

# Dependency to get the database session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Helper: Extract text from PDF
def extract_text_from_pdf(file_path: str) -> str:
    try:
        with open(file_path, "rb") as file:
            pdf_reader = PyPDF2.PdfReader(file)
            text = ""
            for page in pdf_reader.pages:
                text += page.extract_text()
            return text
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error extracting text from PDF: {str(e)}")

# Helper: Analyze text with OpenAI and compute scores
def analyze_text_with_openai(text: str) -> dict:
    prompt = f"""
    **IMPORTANT** Do not bold (**) and do not include titles and -, start each points with either ("summary:", "risk:", "opportunity:", "neutral:", or "anomaly:") also add what file it came from
     Analyze the following document text:
     The documents are seperated but analyse it as one interconnected unit
     make it detailed and professional and usefull to a Private equity firm
     1. Summarize the document content in 3-5 concise bullet points.
     2. Identify and categorize key clauses into:
        - Risks: Potential issues or liabilities.
        - Opportunities: Potential benefits or advantages.
        - Neutral: Standard or informational clauses.
     3. Highlight any inconsistencies or anomalies in the data or agreements.
     also include a risk and opportunity score from scale 1 to 10 in the format ("R_score:" , "O_score") **IMPORTANT** in a new seperate line at the bottom
     
     Document:
     {text}
     """
    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are an expert document analyzer."},
                {"role": "user", "content": prompt},
            ],
            max_tokens=800,
        )

        # Parse response content
        response_content = response.choices[0].message.content
        print(response.choices[0].message.content)
        summary = []
        clauses = {"risk": [], "opportunity": [], "neutral": []}
        anomalies = []
        risk_score = 0
        opportunity_score = 0
        # Simple parsing based on response format (adjust if necessary)
        for line in response_content.split("\n"):
            if line.lower().startswith("summary:"):
                summary.append(line[8:].strip())
            elif line.lower().startswith("risk:"):
                clauses["risk"].append(line[9:].strip())
            elif line.lower().startswith("opportunity:"):
                clauses["opportunity"].append(line[11:].strip())
            elif line.lower().startswith("neutral:"):
                clauses["neutral"].append(line[8:].strip())
            elif line.lower().startswith("anomaly:"):
                anomalies.append(line[8:].strip())
            elif "R_score" in line:
                risk_score = int(line[8:].strip())
                print(int(line[8:].strip()))
            elif "O_score" in line:
                opportunity_score = int(line[8:].strip())




        return {
            "summary": summary,
            "clauses": clauses,
            "anomalies": anomalies,
            "risk_score": risk_score,
            "opportunity_score": opportunity_score,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OpenAI API call failed: {str(e)}")

@app.post("/upload-documents/")
async def upload_documents(files: list[UploadFile] = File(...), db: Session = Depends(get_db)):
    """
    Endpoint to upload multiple documents and perform a combined analysis.
    """
    combined_text = ""  # Store combined text from all files

    for file in files:
        file_path = os.path.join(UPLOAD_DIR, file.filename)
        with open(file_path, "wb") as f:
            f.write(await file.read())

        # Extract text based on file type
        if file.content_type == "application/pdf":
            combined_text += "NEW FILE:" + file.filename + "\n"
            combined_text += extract_text_from_pdf(file_path) + "\n"
        elif file.content_type.startswith("image/"):
            combined_text += "NEW FILE:" + file.filename + "\n"
            combined_text += pytesseract.image_to_string(Image.open(file_path)) + "\n"
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported file type for {file.filename}")

        # Cleanup temporary file
        os.remove(file_path)

    # Analyze the combined text
    analysis = analyze_text_with_openai(combined_text)

    # Log the combined text and analysis to the database
    log = Log(request_text=combined_text, response_text=str(analysis))
    db.add(log)
    db.commit()
    db.refresh(log)

    return {
        "combined_text_length": len(combined_text),
        "summary": analysis["summary"],
        "ratings": {
            "risk_score": analysis["risk_score"],
            "opportunity_score": analysis["opportunity_score"],
        },
        "clauses": analysis["clauses"],
        "anomalies": analysis["anomalies"],
    }

@app.get("/logs/")
def get_logs(db: Session = Depends(get_db)):
    logs = db.query(Log).all()
    return [{"id": log.id, "request": log.request_text, "response": log.response_text, "timestamp": log.timestamp} for log in logs]