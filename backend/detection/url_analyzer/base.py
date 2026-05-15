import logging
from typing import Tuple

logger = logging.getLogger(__name__)


class UrlSubCheck:
    name: str = "base_check"
    weight: float = 0.0

    def run(self, url: str) -> Tuple[float, str]:
        """
        Executes sub-check with global fallback handling.
        Returns (score, reason) tuple.
        Ensures external service failures never crash the scanning route.
        """
        try:
            return self._execute(url)
        except Exception as e:
            logger.error(f"Error in {self.name}: {str(e)}")
            return self._fallback_score()

    def _execute(self, url: str) -> Tuple[float, str]:
        raise NotImplementedError

    def _fallback_score(self) -> Tuple[float, str]:
        return 0.0, ""