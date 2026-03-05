from tools.echo_tools import search_tool, scrape_tool
import json

print("\n--- Testing Search Tool ---")
res = search_tool("latest spacex launch", max_results=2)
print(json.dumps(res, indent=2))

print("\n--- Testing Scrape Tool ---")
if res["result"] and isinstance(res["result"], list):
    url = res["result"][0]["url"]
    print(f"Scraping: {url}")
    scrape_res = scrape_tool(url)
    # Don't print full content, just metadata
    scrape_res["result"]["content"] = scrape_res["result"]["content"][:100] + "..."
    print(json.dumps(scrape_res, indent=2))
else:
    print("Search failed, skipping scrape test.")
