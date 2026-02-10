"""
Pytest config.

CI runs `pytest` as a console script, which does not always include the backend
working directory on `sys.path` early enough for `import app` in test modules.
Make imports deterministic by explicitly adding the backend root to `sys.path`.
"""

from __future__ import annotations

import sys
from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

