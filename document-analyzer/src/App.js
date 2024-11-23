import React, { useState } from "react";
import axios from "axios";

function App() {
  const [files, setFiles] = useState([]);
  const [results, setResults] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [viewLogs, setViewLogs] = useState(false);

  // Handle multiple file selection
  const handleFileChange = (event) => {
    setFiles((prevFiles) => [...prevFiles, ...Array.from(event.target.files)]);
  };

  // Upload selected files and fetch combined analysis
  const handleUpload = async () => {
    if (files.length === 0) {
      alert("Please select at least one file.");
      return;
    }

    const formData = new FormData();
    files.forEach((file) => {
      formData.append("files", file);
    });

    setLoading(true);
    try {
      const response = await axios.post("http://127.0.0.1:8000/upload-documents/", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setResults(response.data); // Save results from combined analysis
    } catch (error) {
      console.error("Error uploading files:", error);
      alert("Failed to analyze the documents.");
    } finally {
      setLoading(false);
    }
  };

  // Clear uploaded files
  const clearFiles = () => {
    setFiles([]);
  };

  // Fetch logs from the backend
  const fetchLogs = async () => {
    setLoading(true);
    try {
      const response = await axios.get("http://127.0.0.1:8000/logs/");
      setLogs(response.data);
    } catch (error) {
      console.error("Error fetching logs:", error);
      alert("Failed to fetch logs.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
      <h1>Document Analyzer</h1>
      <p>Upload multiple documents to combine and analyze their content.</p>

      {!viewLogs ? (
        <div>
          {/* File input for multiple uploads */}
          <input type="file" multiple onChange={handleFileChange} />
          <button onClick={handleUpload} disabled={loading} style={{ marginLeft: "10px" }}>
            {loading ? "Uploading and Analyzing..." : "Analyze"}
          </button>
          <button onClick={clearFiles} style={{ marginLeft: "10px" }}>
            Clear Files
          </button>
          <button onClick={() => { setViewLogs(true); fetchLogs(); }} style={{ marginLeft: "10px" }}>
            View Logs
          </button>

          {/* Display current file names */}
          <div style={{ marginTop: "10px" }}>
            <strong>Selected Files:</strong>
            <ul>
              {files.map((file, index) => (
                <li key={index}>{file.name}</li>
              ))}
            </ul>
          </div>

          {/* Display analysis results */}
          {results && (
            <div style={{ marginTop: "30px" }}>
              <h2>Combined Analysis Results</h2>

              <h3>Summary</h3>
              <ul>
                {results.summary.map((point, index) => (
                  <li key={index}>{point}</li>
                ))}
              </ul>

              <h3>Ratings</h3>
              <p>
                <strong>Risk Score:</strong> {results.ratings.risk_score} / 10
              </p>
              <p>
                <strong>Opportunity Score:</strong> {results.ratings.opportunity_score} / 10
              </p>

              <h3>Clauses</h3>
              <div>
                <strong>Risks:</strong>
                <ul>
                  {results.clauses.risk.map((clause, index) => (
                    <li key={index}>{clause}</li>
                  ))}
                </ul>
              </div>
              <div>
                <strong>Opportunities:</strong>
                <ul>
                  {results.clauses.opportunity.map((clause, index) => (
                    <li key={index}>{clause}</li>
                  ))}
                </ul>
              </div>
              <div>
                <strong>Neutral Clauses:</strong>
                <ul>
                  {results.clauses.neutral.map((clause, index) => (
                    <li key={index}>{clause}</li>
                  ))}
                </ul>
              </div>

              <h3>Anomalies</h3>
              <ul>
                {results.anomalies.map((anomaly, index) => (
                  <li key={index}>{anomaly}</li>
                ))}
              </ul>

              {/* Option to add more files */}
              <div style={{ marginTop: "20px" }}>
                <input type="file" multiple onChange={handleFileChange} />
                <button onClick={handleUpload} disabled={loading} style={{ marginLeft: "10px" }}>
                  Add More Files and Reanalyze
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div>
          <button onClick={() => setViewLogs(false)}>Back to Analyzer</button>
          <h2>Logs</h2>
          {loading ? (
            <p>Loading logs...</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "20px" }}>
              <thead>
                <tr>
                  <th style={{ border: "1px solid #ddd", padding: "8px" }}>ID</th>
                  <th style={{ border: "1px solid #ddd", padding: "8px" }}>Request</th>
                  <th style={{ border: "1px solid #ddd", padding: "8px" }}>Response</th>
                  <th style={{ border: "1px solid #ddd", padding: "8px" }}>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {logs.length > 0 ? (
                  logs.map((log) => (
                    <tr key={log.id}>
                      <td style={{ border: "1px solid #ddd", padding: "8px" }}>{log.id}</td>
                      <td style={{ border: "1px solid #ddd", padding: "8px", maxWidth: "300px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {log.request}
                      </td>
                      <td style={{ border: "1px solid #ddd", padding: "8px", maxWidth: "300px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {log.response}
                      </td>
                      <td style={{ border: "1px solid #ddd", padding: "8px" }}>{log.timestamp}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" style={{ textAlign: "center", padding: "10px" }}>
                      No logs found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
