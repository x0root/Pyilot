import subprocess
import sys

def open_explorer(path="."):
    """Opens Windows Explorer at the specified path.

    Args:
        path: The path to open in Explorer. Defaults to the current directory.
              If no path is provided via command line, it will default to the current directory.
    """
    try:
        subprocess.run(["explorer", path], check=True)
    except FileNotFoundError:
        print("Explorer not found or accessible.  Ensure your system has a file explorer and it's properly configured.")
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) > 1:
        path_to_open = sys.argv[1]
    else:
        path_to_open = "."  # Default to the current directory

    open_explorer(path_to_open)
