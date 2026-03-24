class StrategyFactory:
    """
    Clase para gestionar estrategias.
    """
    def __init__(self):
        self.strategies = {}

    def register_strategy(self, name, strategy):
        """
        Registra una estrategia.
        """
        if name in self.strategies:
            raise ValueError(f"Estrategia '{name}' ya registrada")
        self.strategies[name] = strategy

    def get_strategy(self, name):
        """
        Obtiene una estrategia por su nombre.
        """
        strategy = self.strategies.get(name)
        if not strategy:
            raise ValueError(f"Estrategia '{name}' no encontrada")
        return strategy
