"""Debug test: inspect page DOM after load."""
from playwright.sync_api import sync_playwright
import time

BASE = "http://localhost:5173/src/options/index.html"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()

    errors = []
    def on_console(msg):
        if msg.type == "error":
            errors.append(msg.text)
    page.on("console", on_console)

    page.goto(BASE)
    page.wait_for_load_state("domcontentloaded")
    time.sleep(1.0)

    print("Title:", page.title())
    print("URL:", page.url)

    # Count elements
    print("\nElements:")
    print(f"  buttons: {page.locator('button').count()}")
    print(f"  inputs: {page.locator('input').count()}")
    print(f"  textareas: {page.locator('textarea').count()}")
    print(f"  dialogs: {page.locator('[role=dialog]').count()}")
    print(f"  tabs: {page.locator('.ant-tabs-tab, [role=tab]').count()}")

    # Get body HTML snippet
    body = page.locator("body").inner_html()
    print(f"\nBody HTML (first 2000 chars):\n{body[:2000]}")

    print(f"\nConsole errors: {errors}")

    # Check if there's an iframe
    iframes = page.locator("iframe").count()
    print(f"\nIframes: {iframes}")

    browser.close()
