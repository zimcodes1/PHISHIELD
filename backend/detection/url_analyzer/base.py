import logging
import asyncio
from typing import Tuple

logger = logging.getLogger(__name__)


class UrlSubCheck:
    name: str = "base_check"
    weight: float = 0.0
    timeout_seconds: float = 5.0

    async def run(self, url: str) -> Tuple[float, str]:
        """
        Executes sub-check with global fallback handling.
        Returns (score, reason) tuple.
        Ensures external service failures never crash the scanning route.
        """
        try:
            return await asyncio.wait_for(self._execute(url), timeout=self.timeout_seconds)
        except asyncio.TimeoutError:
            logger.warning("%s timed out after %.1fs", self.name, self.timeout_seconds)
            return self._fallback_score()
        except Exception as e:
            logger.exception("Error in %s: %s", self.name, str(e))
            return self._fallback_score()

    async def _execute(self, url: str) -> Tuple[float, str]:
        raise NotImplementedError

    def _fallback_score(self) -> Tuple[float, str]:
        return 0.0, f"{self.name} unavailable"

class ReputationAnalysisLayer:
    pass
