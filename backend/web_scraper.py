"""
Web scraping and content extraction utilities for ECHO AI.
Handles extracting clean, readable content from web pages.
"""

import requests
from bs4 import BeautifulSoup
import trafilatura
from typing import Dict, Optional, List
from urllib.parse import urlparse
import time

# Known credible domains (can be expanded)
CREDIBLE_DOMAINS = {
    'wikipedia.org': 0.95,
    'britannica.com': 0.9,
    'nature.com': 0.95,
    'science.org': 0.95,
    'nytimes.com': 0.85,
    'reuters.com': 0.9,
    'bbc.com': 0.9,
    'cnn.com': 0.8,
    'gov': 0.95,  # Government sites
    'edu': 0.9,   # Educational institutions
}

def scrape_url(url: str, timeout: int = 10) -> Dict:
    """
    Extract clean content from a URL.
    
    Args:
        url: The URL to scrape
        timeout: Request timeout in seconds
        
    Returns:
        Dict with 'title', 'content', 'url', 'success', and 'error' keys
    """
    result = {
        'url': url,
        'title': '',
        'content': '',
        'success': False,
        'error': None
    }
    
    try:
        # Add delay to be respectful
        time.sleep(0.5)
        
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
        
        response = requests.get(url, headers=headers, timeout=timeout)
        response.raise_for_status()
        
        # Use trafilatura for main content extraction (best for articles)
        content = trafilatura.extract(response.text, include_comments=False, 
                                     include_tables=True, no_fallback=False)
        
        if content:
            result['content'] = content
            result['success'] = True
            
            # Extract title using BeautifulSoup
            soup = BeautifulSoup(response.text, 'lxml')
            title_tag = soup.find('title')
            if title_tag:
                result['title'] = title_tag.get_text().strip()
        else:
            # Fallback to BeautifulSoup if trafilatura fails
            soup = BeautifulSoup(response.text, 'lxml')
            
            # Remove script and style elements
            for script in soup(['script', 'style', 'nav', 'footer', 'header']):
                script.decompose()
            
            # Get text
            text = soup.get_text(separator='\n', strip=True)
            
            # Clean up whitespace
            lines = [line.strip() for line in text.splitlines() if line.strip()]
            result['content'] = '\n'.join(lines)
            result['success'] = True
            
            title_tag = soup.find('title')
            if title_tag:
                result['title'] = title_tag.get_text().strip()
                
    except requests.exceptions.Timeout:
        result['error'] = 'Request timeout'
    except requests.exceptions.RequestException as e:
        result['error'] = f'Request failed: {str(e)}'
    except Exception as e:
        result['error'] = f'Scraping error: {str(e)}'
    
    return result


def extract_main_content(html: str) -> str:
    """
    Extract main content from HTML string.
    
    Args:
        html: HTML content as string
        
    Returns:
        Cleaned text content
    """
    # Try trafilatura first
    content = trafilatura.extract(html, include_comments=False, 
                                 include_tables=True, no_fallback=False)
    
    if content:
        return content
    
    # Fallback to BeautifulSoup
    soup = BeautifulSoup(html, 'lxml')
    
    # Remove unwanted elements
    for element in soup(['script', 'style', 'nav', 'footer', 'header', 'aside']):
        element.decompose()
    
    text = soup.get_text(separator='\n', strip=True)
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    
    return '\n'.join(lines)


def is_credible_source(url: str) -> float:
    """
    Score the credibility of a source based on domain.
    
    Args:
        url: The URL to evaluate
        
    Returns:
        Credibility score between 0 and 1
    """
    try:
        domain = urlparse(url).netloc.lower()
        
        # Check exact matches
        for credible_domain, score in CREDIBLE_DOMAINS.items():
            if credible_domain in domain:
                return score
        
        # Default score for unknown domains
        return 0.5
        
    except Exception:
        return 0.3


def deduplicate_results(results: List[Dict]) -> List[Dict]:
    """
    Remove duplicate search results based on URL and content similarity.
    
    Args:
        results: List of result dictionaries
        
    Returns:
        Deduplicated list of results
    """
    seen_urls = set()
    seen_titles = set()
    unique_results = []
    
    for result in results:
        url = result.get('href', '').lower()
        title = result.get('title', '').lower()
        
        # Skip if we've seen this URL
        if url in seen_urls:
            continue
        
        # Skip if we've seen very similar title
        if title and title in seen_titles:
            continue
        
        seen_urls.add(url)
        if title:
            seen_titles.add(title)
        
        unique_results.append(result)
    
    return unique_results
