import json
import os
import logging
import boto3
from botocore.exceptions import ClientError
from db_handler import PostgreSQLHandler

# Configurar el logger
logger = logging.getLogger()
logger.setLevel(logging.INFO)
secrets_manager = boto3.client('secretsmanager')

class DBInstance:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            db_config = get_database_credentials()
            cls._instance = super().__new__(cls)
            cls._instance.db = PostgreSQLHandler(db_config)

        return cls._instance

def get_database_credentials():
    secret_name = os.getenv("DB_SECRET_ARN")
    try:
        # response = secrets_manager.get_secret_value(SecretId=secret_name)
        # secret_string = response['SecretString']
        # credentials = json.loads(secret_string)
        return {
            "host": 'hl-database.czs6gaiw2kco.us-east-1.rds.amazonaws.com',
            "dbname": 'HLDB',
            "user": 'hladmin',
            "password": 'nyryJ1Ghb3VOVuHHIdw7vQPBIELFiG4Z',
            # "host": credentials['host'],
            # "dbname": 'HLAdminDB',
            # "username": credentials['username'],
            # "password": credentials['password']
        }
    except ClientError as e:
        logger.error("Error al obtener credenciales de Secrets Manager", exc_info=True)
        raise e
