"""Limits how often one visitor can hit an endpoint (stops spam and abuse)."""
from slowapi import Limiter

from .clientip import client_ip

limiter = Limiter(key_func=client_ip)
