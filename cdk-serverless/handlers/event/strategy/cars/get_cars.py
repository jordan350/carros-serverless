import json

class BaseStrategy:
    """
    Clase base para todas las estrategias.
    """
    def process(self, data):
        raise NotImplementedError("Debe implementarse el método 'process' en la estrategia")

class GetCarsStrategy(BaseStrategy):
    def __init__(self, cars_service):
        self.cars_service = cars_service

    def process(self, data):
        """
        Procesa datos relacionados con eventos.
        """
        return self.cars_service.get_cars(data)