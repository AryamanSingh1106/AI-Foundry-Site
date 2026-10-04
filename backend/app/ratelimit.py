"""Limits how often one visitor can hit an endpoint (stops spam and abuse)."""
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
