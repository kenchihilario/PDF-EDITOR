import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Search, X, ChevronUp, ChevronDown } from 'lucide-react';

const SearchBar = ({ pdfDoc, scale, onHighlightMatches, onNavigateToPage, onClose }) => {
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef(null);
  const searchRunRef = useRef(0);
  const onHighlightMatchesRef = useRef(onHighlightMatches);
  const onNavigateToPageRef = useRef(onNavigateToPage);

  useEffect(() => {
    onHighlightMatchesRef.current = onHighlightMatches;
    onNavigateToPageRef.current = onNavigateToPage;
  }, [onHighlightMatches, onNavigateToPage]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const performSearch = useCallback(async (searchText) => {
    if (!pdfDoc || !searchText) return;
    const runId = ++searchRunRef.current;
    setIsSearching(true);

    const results = [];
    const lowerSearch = searchText.toLowerCase();

    for (let i = 1; i <= pdfDoc.numPages; i++) {
      try {
        const page = await pdfDoc.getPage(i);
        const textContent = await page.getTextContent();
        if (runId !== searchRunRef.current) return;
        const viewport = page.getViewport({ scale });

        for (const item of textContent.items) {
          const text = item.str.toLowerCase();
          let startIdx = 0;

          while (true) {
            const idx = text.indexOf(lowerSearch, startIdx);
            if (idx === -1) break;

            const tx = item.transform;
            const x = tx[4] * scale;
            const y = viewport.height - (tx[5] * scale);
            const charWidth = (item.width * scale) / item.str.length;
            const matchX = x + idx * charWidth;
            const matchWidth = searchText.length * charWidth;
            const height = item.height * scale;

            results.push({
              pageNum: i,
              x: matchX,
              y: y - height,
              width: matchWidth,
              height: height * 1.3,
              text: item.str.substring(idx, idx + searchText.length)
            });

            startIdx = idx + 1;
          }
        }
      } catch (err) {
        console.error(`Search error on page ${i}:`, err);
      }
    }

    if (runId !== searchRunRef.current) return;
    setMatches(results);
    setCurrentIndex(results.length > 0 ? 0 : -1);
    onHighlightMatchesRef.current(results);
    setIsSearching(false);

    if (results.length > 0) {
      onNavigateToPageRef.current(results[0].pageNum);
    }
  }, [pdfDoc, scale]);

  useEffect(() => {
    const searchText = query.trim();
    if (!searchText) {
      searchRunRef.current += 1;
      onHighlightMatchesRef.current([]);
      return undefined;
    }

    const timer = setTimeout(() => performSearch(searchText), 300);
    return () => {
      clearTimeout(timer);
      searchRunRef.current += 1;
    };
  }, [query, performSearch]);

  const goToMatch = (index) => {
    if (index < 0 || index >= matches.length) return;
    setCurrentIndex(index);
    onNavigateToPage(matches[index].pageNum);
    onHighlightMatches(matches, index);
  };

  const handlePrev = () => {
    const newIndex = currentIndex > 0 ? currentIndex - 1 : matches.length - 1;
    goToMatch(newIndex);
  };

  const handleNext = () => {
    const newIndex = currentIndex < matches.length - 1 ? currentIndex + 1 : 0;
    goToMatch(newIndex);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      if (e.shiftKey) handlePrev();
      else handleNext();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  const handleClose = () => {
    searchRunRef.current += 1;
    onHighlightMatches([]);
    onClose();
  };

  return (
    <div className="search-bar">
      <div className="search-input-wrapper">
        <Search size={16} className="search-icon" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => {
            searchRunRef.current += 1;
            setMatches([]);
            setCurrentIndex(0);
            setIsSearching(false);
            onHighlightMatchesRef.current([]);
            setQuery(e.target.value);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Find in document..."
          className="search-input"
        />
        {query && (
          <span className="search-count">
            {isSearching ? '...' : matches.length > 0 ? `${currentIndex + 1}/${matches.length}` : '0 results'}
          </span>
        )}
      </div>

      <div className="search-nav">
        <button
          className="btn btn-icon"
          onClick={handlePrev}
          disabled={matches.length === 0}
          title="Previous match (Shift+Enter)"
        >
          <ChevronUp size={16} />
        </button>
        <button
          className="btn btn-icon"
          onClick={handleNext}
          disabled={matches.length === 0}
          title="Next match (Enter)"
        >
          <ChevronDown size={16} />
        </button>
        <button className="btn btn-icon" onClick={handleClose} title="Close (Esc)">
          <X size={16} />
        </button>
      </div>
    </div>
  );
};

export default SearchBar;
