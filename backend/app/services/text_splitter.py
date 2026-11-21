import re
import logging
from typing import List, Dict, Any
from app.config import settings

logger = logging.getLogger(__name__)

class RecursiveTextSplitter:
    def __init__(self, chunk_size: int = None, chunk_overlap: int = None, separators: List[str] = None):
        self.chunk_size = chunk_size or settings.CHUNK_SIZE
        self.chunk_overlap = chunk_overlap or settings.CHUNK_OVERLAP
        self.separators = separators or ["\n\n", "\n", ". ", "? ", "! ", "; ", ", ", " ", ""]

        if self.chunk_overlap >= self.chunk_size:
            raise ValueError("chunk_overlap must be smaller than chunk_size")

    def split_text(self, text: str) -> List[str]:
        """Splits a single text string into overlapping chunks recursively."""
        if not text:
            return []
        return self._split(text, self.separators)

    def _split(self, text: str, separators: List[str]) -> List[str]:
        final_chunks: List[str] = []
        separator = separators[-1]
        new_separators = []

        for i, sep in enumerate(separators):
            if sep == "":
                separator = ""
                break
            if sep in text:
                separator = sep
                new_separators = separators[i + 1:]
                break

        splits = text.split(separator) if separator else list(text)

        good_splits: List[str] = []
        for s in splits:
            if not s:
                continue
            if len(s) < self.chunk_size:
                good_splits.append(s)
            else:
                if new_separators:
                    other_splits = self._split(s, new_separators)
                    good_splits.extend(other_splits)
                else:
                    # Direct slice
                    for j in range(0, len(s), self.chunk_size - self.chunk_overlap):
                        good_splits.append(s[j:j + self.chunk_size])

        # Merge good splits respecting chunk_size and chunk_overlap
        current_chunk: List[str] = []
        current_len = 0

        for piece in good_splits:
            piece_len = len(piece) + (len(separator) if current_chunk else 0)
            if current_len + piece_len <= self.chunk_size:
                current_chunk.append(piece)
                current_len += piece_len
            else:
                if current_chunk:
                    merged = separator.join(current_chunk).strip()
                    if merged:
                        final_chunks.append(merged)
                    
                    # Compute overlap from the end of current_chunk
                    while current_chunk and current_len > self.chunk_overlap:
                        removed = current_chunk.pop(0)
                        current_len -= len(removed) + (len(separator) if current_chunk else 0)

                current_chunk.append(piece)
                current_len += len(piece) + (len(separator) if len(current_chunk) > 1 else 0)

        if current_chunk:
            merged = separator.join(current_chunk).strip()
            if merged:
                final_chunks.append(merged)

        return final_chunks

    def split_documents(self, documents: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Takes parsed document segments with metadata and produces chunks with preserved metadata.
        Each input: {"text": str, "metadata": dict}
        Each output: {"content": str, "chunk_index": int, "metadata": dict}
        """
        chunks = []
        chunk_idx = 0
        for doc in documents:
            text = doc.get("text", "")
            base_meta = doc.get("metadata", {})
            sub_chunks = self.split_text(text)

            for sc in sub_chunks:
                meta = dict(base_meta)
                meta["char_count"] = len(sc)
                chunks.append({
                    "chunk_index": chunk_idx,
                    "content": sc,
                    "metadata": meta
                })
                chunk_idx += 1

        return chunks

