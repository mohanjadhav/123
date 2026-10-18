from typing import List

from pydantic import BaseModel


class WorkspaceState(BaseModel):
    """Which labels are open in the designer and which one was used last — restored on every app start."""
    open_tabs: List[str] = []
    active_tab: str = ""
