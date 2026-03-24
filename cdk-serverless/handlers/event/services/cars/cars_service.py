from dbinstance.dbinstance import DBInstance

class CarsService:
    """
    Servicio para manejar eventos.
    """
    def __init__(self):
        self.db = DBInstance().db

    def get_cars(self, data=None):
        """
        Devuelve la información de un evento dado su ID.
        """
        # Parsear los datos recibidos
        if data:
            name = data.get('name')
            if not name:
                raise ValueError("Falta el nombre del carro")
            car = self.db.read('cars', {'name': name});
        else:
            query = "SELECT * FROM cars ORDER BY id DESC LIMIT 100"
            car = self.db.execute_query(query, fetchall=True);
        
        if not car:
            return None
        return car
        
        
