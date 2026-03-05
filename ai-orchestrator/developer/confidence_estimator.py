import re

class ConfidenceEstimator:

    def extract_confidence(self, model_response):
        """
        Expect model to return:
        CONFIDENCE: 0.83
        """
        return float(match.group(1)) if (match := re.search(r"CONFIDENCE:\s*(0\.\d+|1\.0)", model_response)) else 0.5
