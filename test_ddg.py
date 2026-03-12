from ddgs import DDGS

def test():
    print("Testing DDGS directly...")
    try:
        with DDGS() as ddgs:
            results = ddgs.text("weather in Belgrade", max_results=2)
            for r in results:
                print(r)
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test()
