"""CrewAI tool stub for AgentReader convert_document."""
from crewai.tools import BaseTool
from pydantic import BaseModel, Field
import requests

class ConvertInput(BaseModel):
    url: str = Field(..., description="Public PDF/DOCX/HTML URL")
    format: str = Field("markdown", description="markdown or text")

class ConvertDocumentTool(BaseTool):
    name: str = "convert_document"
    description: str = (
        "Convert a public PDF/DOCX/HTML URL to markdown or text for RAG. "
        "Costs $0.03 USDC via x402. Use when you need document text, not a web page (/read)."
    )
    args_schema: type[BaseModel] = ConvertInput

    def _run(self, url: str, format: str = "markdown") -> str:
        r = requests.get(
            "https://api.axiomworks.co.uk/convert",
            params={"url": url, "format": format},
            timeout=120,
        )
        if r.status_code == 402:
            return "HTTP 402: settle with x402 then retry (see examples/x402_fetch.py)."
        return r.text
