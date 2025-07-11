import subprocess
import sys

def open_chrome(url):
    """Opens Google Chrome with the specified URL.

    Args:
        url: The URL to open in Chrome.  If empty, opens Chrome to the default page.
    """
    try:
        subprocess.run(["chrome", url], check=True) # Most systems have chrome in their path.  If not...see below
    except FileNotFoundError:
        try:
            # Try a common Chrome install location (Windows) - but still don't HARDCODE!  Make the USER specify if needed.
            subprocess.run([r"C:\Program Files\Google\Chrome\Application\chrome.exe", url], check=True)
        except FileNotFoundError:
            print("Google Chrome not found in standard locations.  Please ensure Chrome is installed and in your system's PATH, or specify the full path to chrome.exe.")
            sys.exit(1)  # Exit with an error code

if __name__ == "__main__":
    if len(sys.argv) > 1:
        url_to_open = sys.argv[1]
    else:
        url_to_open = ""  # Open Chrome to its default page if no URL is provided

    open_chrome(url_to_open)
