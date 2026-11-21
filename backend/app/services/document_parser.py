import os
import csv
import io
import logging
from typing import List, Dict, Any
from pypdf import PdfReader
from docx import Document as DocxDocument

logger = logging.getLogger(__name__)

class DocumentParser:
    @staticmethod
    def parse_file(file_path: str, filename: str, file_type: str) -> List[Dict[str, Any]]:
        """
        Parses different file types and returns a list of dictionaries with text and metadata.
        Each item is: {"text": str, "metadata": {"page": int, ...}}
        """
        extension = file_type.lower().strip(".")
        if not extension and "." in filename:
            extension = filename.rsplit(".", 1)[-1].lower()

        logger.info(f"Parsing file {filename} with extension {extension}")

        if extension == "pdf":
            return DocumentParser._parse_pdf(file_path)
        elif extension in ["docx", "doc"]:
            return DocumentParser._parse_docx(file_path)
        elif extension == "csv":
            return DocumentParser._parse_csv(file_path)
        elif extension in ["txt", "md", "markdown", "json", "log"]:
            return DocumentParser._parse_text(file_path)
        else:
            # Fallback to plain text read
            return DocumentParser._parse_text(file_path)

    @staticmethod
    def _parse_pdf(file_path: str) -> List[Dict[str, Any]]:
        results = []
        try:
            reader = PdfReader(file_path)
            total_pages = len(reader.pages)
            for page_num, page in enumerate(reader.pages, start=1):
                text = page.extract_text() or ""
                cleaned_text = text.strip()
                if cleaned_text:
                    results.append({
                        "text": cleaned_text,
                        "metadata": {
                            "page": page_num,
                            "total_pages": total_pages
                        }
                    })
        except Exception as e:
            logger.error(f"Error parsing PDF file {file_path}: {e}")
            raise ValueError(f"Failed to parse PDF: {str(e)}")
        
        return results

    @staticmethod
    def _parse_docx(file_path: str) -> List[Dict[str, Any]]:
        results = []
        try:
            doc = DocxDocument(file_path)
            paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
            
            # Also extract tables
            table_texts = []
            for table in doc.tables:
                for row in table.rows:
                    row_cells = [cell.text.strip() for cell in row.cells if cell.text.strip()]
                    if row_cells:
                        table_texts.append(" | ".join(row_cells))
            
            full_content = "\n\n".join(paragraphs + table_texts)
            if full_content.strip():
                results.append({
                    "text": full_content.strip(),
                    "metadata": {"type": "docx"}
                })
        except Exception as e:
            logger.error(f"Error parsing DOCX file {file_path}: {e}")
            raise ValueError(f"Failed to parse DOCX: {str(e)}")
        
        return results

    @staticmethod
    def _parse_csv(file_path: str) -> List[Dict[str, Any]]:
        results = []
        try:
            with open(file_path, mode="r", encoding="utf-8", errors="replace") as f:
                reader = csv.reader(f)
                rows = list(reader)
                if not rows:
                    return results

                header = rows[0]
                row_texts = []
                for row_idx, row in enumerate(rows[1:], start=1):
                    row_desc = ", ".join([f"{h}: {val}" for h, val in zip(header, row) if val.strip()])
                    if row_desc:
                        row_texts.append(f"Row {row_idx}: {row_desc}")

                combined_csv = "\n".join(row_texts)
                if combined_csv:
                    results.append({
                        "text": combined_csv,
                        "metadata": {"type": "csv", "total_rows": len(rows) - 1}
                    })
        except Exception as e:
            logger.error(f"Error parsing CSV file {file_path}: {e}")
            raise ValueError(f"Failed to parse CSV: {str(e)}")

        return results

    @staticmethod
    def _parse_text(file_path: str) -> List[Dict[str, Any]]:
        try:
            with open(file_path, mode="r", encoding="utf-8", errors="replace") as f:
                content = f.read().strip()
                if content:
                    return [{
                        "text": content,
                        "metadata": {"type": "text"}
                    }]
                return []
        except Exception as e:
            logger.error(f"Error parsing text file {file_path}: {e}")
            raise ValueError(f"Failed to parse text document: {str(e)}")

