class CostTracker:
    def __init__(self):
        self.total_cost = 0.0

    def record(self, tokens, cost_per_1k=0.015): # Default approx for DeepSeek-R1
        cost = (tokens / 1000) * cost_per_1k
        self.total_cost += cost
        return cost

    def get_total_cost(self):
        return round(self.total_cost, 4)
