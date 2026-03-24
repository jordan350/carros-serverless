import psycopg2
import psycopg2.extras
import logging

logger = logging.getLogger()
logger.setLevel(logging.INFO)

class PostgreSQLHandler:
    def __init__(self, db_config):
        """
        Inicializa el manejador PostgreSQL.
        :param db_config: Diccionario con las claves 'host', 'dbname', 'user', 'password'.
        """
        self.db_config = db_config

    def execute_query(self, query, params=None, fetchone=False, fetchall=False):
        """
        Ejecuta una consulta SQL.
        :param query: Cadena con la consulta SQL.
        :param params: Parámetros para la consulta SQL (tupla o lista).
        :param fetchone: Indica si se debe devolver solo un registro.
        :param fetchall: Indica si se deben devolver todos los registros.
        :return: Resultado(s) de la consulta, si aplica.
        """
        try:
            print("QUERY: ", query)
            with psycopg2.connect(**self.db_config) as conn:
                with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cursor:
                    cursor.execute(query, params)
                    if fetchone:
                        return cursor.fetchone()
                    if fetchall:
                        return cursor.fetchall()
                    conn.commit()
                    return cursor.rowcount
        except Exception as e:
            logger.error(f"Error ejecutando la consulta: {e}")
            raise

    def create(self, table, data):
        """
        Inserta un nuevo registro en la tabla.
        :param table: Nombre de la tabla.
        :param data: Diccionario con los datos a insertar.
        :return: ID del registro insertado.
        """
        keys = ', '.join(data.keys())
        values = ', '.join(['%s'] * len(data))
        query = f"INSERT INTO {table} ({keys}) VALUES ({values}) RETURNING *;"
        return self.execute_query(query, tuple(data.values()), fetchall=True)
        # query = f"INSERT INTO {table} ({keys}) VALUES ({values}) RETURNING id;"
        # return self.execute_query(query, tuple(data.values()), fetchone=True)['id']

    def read(self, table, conditions=None, joins=None):
        """
        Lee registros de la tabla con condiciones opcionales y datos de tablas relacionadas.
        :param table: Nombre de la tabla principal.
        :param conditions: Diccionario con las condiciones WHERE (columna: valor).
        :param joins: Lista de tuplas para las tablas relacionadas. Cada tupla debe ser:
                    (tabla_relacionada, columna_tabla_principal, columna_tabla_relacionada).
        :return: Lista de registros que cumplen las condiciones.
        """
        query = f"SELECT {table}.*"
        params = []

        # Agregar alias a las columnas de la tabla principal
        primary_columns = f", ".join([f"{table}.{col} AS {table}_{col}" for col in self.get_columns(table)])
        query = f"SELECT {primary_columns}"

        # Agregar alias a las columnas de tablas relacionadas
        if joins:
            for join in joins:
                related_table, _, _ = join
                related_columns = f", ".join(
                    [f"{related_table}.{col} AS {related_table}_{col}" for col in self.get_columns(related_table)]
                )
                query += f", {related_columns}"

        # FROM y posibles JOINs
        query += f" FROM {table}"
        if joins:
            for join in joins:
                related_table, table_column, related_column = join
                query += f" LEFT JOIN {related_table} ON {table}.{table_column} = {related_table}.{related_column}"

        # WHERE cláusula
        if conditions:
            where_clause = ' AND '.join([f"{key} = %s" for key in conditions.keys()])
            query += f" WHERE {where_clause}"
            params = list(conditions.values())

        return self.execute_query(query, params, fetchall=True)

    def get_columns(self, table):
        """
        Obtiene las columnas de una tabla.
        Este método debe realizar una consulta al esquema de la base de datos
        para devolver la lista de columnas de la tabla proporcionada.
        """
        query = f"""
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = %s
        """
        return [row[0] for row in self.execute_query(query, [table], fetchall=True)]


    def update(self, table, data, conditions, returning=None):
        """
        Actualiza registros en la tabla con condiciones.
        :param table: Nombre de la tabla.
        :param data: Diccionario con los datos a actualizar.
        :param conditions: Diccionario con las condiciones WHERE (columna: valor).
        :return: Número de filas afectadas.
        """
        set_clause = ', '.join([f"{key} = %s" for key in data.keys()])
        where_clause = ' AND '.join([f"{key} = %s" for key in conditions.keys()])
        returning_clause = f"RETURNING {', '.join(returning)}" if returning else ""
        query = f"UPDATE {table} SET {set_clause} WHERE {where_clause} {returning_clause};"
        params = list(data.values()) + list(conditions.values())
        return self.execute_query(query, params, fetchall=True)

    def delete(self, table, conditions):
        """
        Elimina registros de la tabla con condiciones.
        :param table: Nombre de la tabla.
        :param conditions: Diccionario con las condiciones WHERE (columna: valor).
        :return: Número de filas afectadas.
        """
        where_clause = ' AND '.join([f"{key} = %s" for key in conditions.keys()])
        query = f"DELETE FROM {table} WHERE {where_clause};"
        params = list(conditions.values())
        return self.execute_query(query, params)

    def bulk_insert(self, table, data):
        """
        Inserta múltiples registros en la tabla de forma eficiente.
        :param table: Nombre de la tabla.
        :param data: Lista de diccionarios con los datos a insertar.
        :return: Número de filas insertadas.
        """
        if not data:
            logger.warning("No hay datos para insertar.")
            return 0

        keys = data[0].keys()
        columns = ', '.join(keys)
        values_template = '(' + ', '.join(['%s'] * len(keys)) + ')'

        query = f"INSERT INTO {table} ({columns}) VALUES %s"
        values = [tuple(row.values()) for row in data]

        try:
            with psycopg2.connect(**self.db_config) as conn:
                with conn.cursor() as cursor:
                    psycopg2.extras.execute_values(cursor, query, values)
                    conn.commit()
                    return cursor.rowcount
        except Exception as e:
            logger.error(f"Error en la inserción masiva: {e}")
            raise

    def bulk_insert_values(self, table, columns, values):
        query = f"""
            INSERT INTO {table} ({', '.join(columns)})
            VALUES %s
        """
        
        try:
            with psycopg2.connect(**self.db_config) as conn:
                with conn.cursor() as cursor:
                    psycopg2.extras.execute_values(cursor, query, values)
                    conn.commit()
                    return cursor.rowcount
        except Exception as e:
            logger.error(f"Error en la inserción masiva: {e}")
            raise