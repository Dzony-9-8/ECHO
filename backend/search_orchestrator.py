"""
Search orchestration module for ECHO AI.
Coordinates multi-stage search, verification, and response generation.
"""

from typing import List, Dict, Optional
from .tools import search_web
from .web_scraper import scrape_url, is_credible_source, deduplicate_results
from .llm_client import LLMClient
from .weather_tool import get_weather, format_weather_for_echo
from cachetools import TTLCache
import json

# Cache search results for 5 minutes (300 seconds) to prevent stale news/weather
search_cache = TTLCache(maxsize=20, ttl=300)


def should_search_web(user_message: str, llm_client: LLMClient, current_time: str = "Unknown") -> Dict:
    """
    Use LLM to determine if web search or weather lookup is needed.
    Refined for higher precision and specialized topics (sports, news).
    """
    analysis_prompt = f"""Analyze this user message for information retrieval needs.
    
    CRITICAL:
    - If the user asks about a specific entity (club, person, event) and its RECENT status, you MUST search.
    - FK Crvena zvezda is a football club. Matches, results, and transfers require searching.
    - Weather queries for specific cities require is_weather_query: true.

    CURRENT DATE AND TIME: {current_time}
    User message: "{user_message}"

    Respond ONLY with a JSON object:
    {{
        "should_search": true/false,
        "is_weather_query": true/false,
        "weather_locations": ["City 1"],
        "queries": ["precise search query 1", "precise search query 2"],
        "language": "detected language (e.g. Serbian, English)",
        "reason": "explanation"
    }}

    Optimization for Queries:
    - Generate EXACTLY 3 queries for maximum coverage:
      1. SPECIFIC MATCH: e.g., "FK Crvena zvezda latest match result January 2026"
      2. DIRECT VS: e.g., "Crvena zvezda vs Celta Vigo result"
      3. OFFICIAL: e.g., "FK Crvena zvezda official results 2026"
    - If the user mentions a specific team or event, YOU MUST INCLUDE IT in the first query.
    - Be as specific as possible to find recent facts from the last 48 hours.
    """

    try:
        response = llm_client.generate_response(analysis_prompt)
        
        # Try to extract JSON from response
        start = response.find('{')
        end = response.rfind('}') + 1
        
        if start != -1 and end > start:
            json_str = response[start:end]
            result = json.loads(json_str)
            
            return {
                'should_search': result.get('should_search', False),
                'is_weather_query': result.get('is_weather_query', False),
                'weather_locations': result.get('weather_locations', []),
                'queries': result.get('queries', []),
                'language': result.get('language', 'English'),
                'reason': result.get('reason', '')
            }
        else:
            # Fallback
            keywords = ['what is', 'who is', 'when did', 'where is', 'result', 'match', 'weather', 'score']
            should_search = any(kw in user_message.lower() for kw in keywords)
            return {
                'should_search': should_search,
                'is_weather_query': 'weather' in user_message.lower(),
                'weather_locations': [], # Fallback can't guess city easily without more logic
                'queries': [user_message] if should_search else [],
                'language': 'English',
                'reason': 'Fallback keyword detection'
            }
            
    except Exception as e:
        return {
            'should_search': False,
            'is_weather_query': False,
            'weather_locations': [],
            'queries': [],
            'language': 'English',
            'reason': f'Error in analysis: {str(e)}'
        }


def aggregate_sources(queries: List[str], max_results_per_query: int = 5) -> List[Dict]:
    """
    Perform searches for multiple queries and aggregate results.
    
    Args:
        queries: List of search queries
        max_results_per_query: Maximum results per query
        
    Returns:
        List of aggregated and deduplicated search results
    """
    all_results = []
    
    for query in queries:
        # Check cache first
        cache_key = f"search:{query}"
        if cache_key in search_cache:
            all_results.extend(search_cache[cache_key])
            continue
        
        # Perform search
        search_results_text = search_web(query, max_results=max_results_per_query)
        
        # Parse results (search_web returns formatted text, we need to parse it)
        # For now, we'll store the raw text and URL extraction
        # In a real implementation, we'd parse the structured results
        
        # Store in cache
        search_cache[cache_key] = [{'query': query, 'results': search_results_text}]
        all_results.append({'query': query, 'results': search_results_text})
    
    return all_results


def extract_content_from_sources(search_results: str, max_sources: int = 3) -> List[Dict]:
    """
    Extract full content from top search result URLs.
    
    Args:
        search_results: Formatted search results text
        max_sources: Maximum number of sources to scrape
        
    Returns:
        List of scraped content dictionaries
    """
    scraped_content = []
    
    # Extract URLs from search results
    # This is a simple implementation - in production, you'd parse structured data
    import re
    urls = re.findall(r'Link: (https?://[^\s]+)', search_results)
    
    # Scrape top URLs
    for url in urls[:max_sources]:
        content = scrape_url(url)
        if content['success']:
            content['credibility'] = is_credible_source(url)
            scraped_content.append(content)
    
    return scraped_content


def intelligent_search(user_message: str, llm_client: LLMClient, current_time: str = "Unknown") -> Dict:
    """
    Main orchestration function for intelligent web search.
    """
    # Stage 1: Determine if search or weather lookup is needed
    decision = should_search_web(user_message, llm_client, current_time=current_time)
    
    results = {
        'searched': False,
        'weather_data': [],
        'scraped_content': [],
        'search_results': [],
        'queries': [],
        'is_weather': decision.get('is_weather_query', False)
    }

    # Stage 2: Perform Weather Lookup (High Accuracy API)
    if decision.get('is_weather_query'):
        locations = decision.get('weather_locations', [])
        for loc in locations:
            w_data = get_weather(loc)
            if w_data.get('success'):
                results['weather_data'].append(w_data)
        results['searched'] = True

    # Stage 3: Perform multi-query search (if needed)
    if decision.get('should_search'):
        queries = decision.get('queries', [])
        results['queries'] = queries
        search_results = aggregate_sources(queries)
        results['search_results'] = search_results
        
        # Stage 4: Extract content from top sources
        for res in search_results:
            scraped = extract_content_from_sources(res['results'], max_sources=2)
            results['scraped_content'].extend(scraped)
        results['searched'] = True

    return results


def format_response_with_citations(search_data: Dict, current_time: str = "Unknown") -> str:
    """
    Format search results, weather data, and snippets for the LLM context.
    """
    if not search_data.get('searched'):
        return ""
    
    formatted = f"=== EXTERNAL DATA (Current Time: {current_time}) ===\n\n"
    
    # 1. Add High-Accuracy Weather Data (if present)
    if search_data.get('weather_data'):
        formatted += "--- DIRECT REAL-TIME WEATHER (API) ---\n"
        for w in search_data['weather_data']:
            formatted += format_weather_for_echo(w) + "\n"
        formatted += "CRITICAL: The weather data above is from a real-time API. Prioritize this over ANY other weather numbers below.\n\n"

    # 2. Add Top Snippets (reliable quick information)
    if search_data.get('search_results'):
        formatted += "--- SEARCH SNIPPETS ---\n"
        for result in search_data['search_results']:
            formatted += f"\n{result.get('results', '')}\n"
        formatted += "\n"
    
    # 3. Add scraped content (detailed information)
    if search_data.get('scraped_content'):
        formatted += "--- FULL CONTENT FROM TOP SOURCES ---\n"
        for idx, content in enumerate(search_data['scraped_content'], 1):
            if content.get('success'):
                formatted += f"[Source {idx}] {content.get('title', 'Untitled')}\n"
                formatted += f"URL: {content['url']}\n"
                formatted += f"Credibility: {content.get('credibility', 0.5):.0%}\n"
                formatted += f"Content (Cleaned): {content['content'][:1500]}...\n\n"
    
    formatted += "=== END EXTERNAL DATA ===\n"
    formatted += "CRITICAL INSTRUCTION: Cross-reference all data. Prioritize REAL-TIME WEATHER API data for current conditions. Mention specific sources naturally.\n"
    
    return formatted

