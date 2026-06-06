"""Adapter registry: map an ATS key to its adapter instance."""
from __future__ import annotations

from .ashby import AshbyAdapter
from .base import BaseAdapter
from .greenhouse import GreenhouseAdapter
from .indeed import IndeedAdapter
from .lever import LeverAdapter
from .linkedin import LinkedInAdapter
from .workday import WorkdayAdapter

_REGISTRY = {
    "greenhouse": GreenhouseAdapter,
    "lever": LeverAdapter,
    "ashby": AshbyAdapter,
    "workday": WorkdayAdapter,
    "linkedin": LinkedInAdapter,
    "indeed": IndeedAdapter,
    "generic": BaseAdapter,
}


def get_adapter(ats: str) -> BaseAdapter:
    return _REGISTRY.get(ats, BaseAdapter)()
