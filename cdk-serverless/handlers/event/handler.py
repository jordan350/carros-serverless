import boto3
import json
import os
import logging
import datetime
from decimal import Decimal
from strategy.factory import StrategyFactory
from strategy.cars.get_cars import GetCarsStrategy
from services.cars.cars_service import CarsService

# logger
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Clientes de AWS
sqs = boto3.client('sqs')

cars_service = CarsService()

strategy_factory = StrategyFactory()
strategy_factory.register_strategy("getCars", GetCarsStrategy(cars_service))

def main(event, context):
    for record in event['Records']:
        try:
            body = json.loads(record['body'])
            logger.info(f"body input: {body}")

            operation_type = body.get("detail", {}).get("messageType", {})
            data = body.get("detail", {}).get("message")
            strategy = strategy_factory.get_strategy(operation_type)
            response = strategy.process(data)
            if isinstance(response, list):
                result = json.dumps([dict(row) for row in response], default=json_default)
            elif response:
                result = json.dumps(dict(response), default=json_default)
            else:
                result = json.dumps([])

            # Extraer el request_id
            request_id = body.get("detail", {}).get("request_id", "")
            body["request_cid"] = request_id
            body["response"] = "REQUEST PROCESADA !!!"
            body["query_result"] = json.loads(result)
            
            if isinstance(body, list):
                message_body = json.dumps([dict(row) for row in body], default=json_default)
            elif isinstance(body, dict):
                message_body = json.dumps(body, default=json_default)
            else:
                message_body = json.dumps([])

            logger.info(f"Data OUT: {message_body}")

            # Enviar el mensaje a la cola de respuesta
            response_queue_url = os.getenv("HL_RESPONSE_QUEUE_URL")
            sqs.send_message(
                QueueUrl=response_queue_url,
                MessageBody=message_body
            )

            # Eliminar el mensaje de la cola de origen
            source_queue_arn = record['eventSourceARN']
            queue_name = source_queue_arn.split(":")[-1]
            source_queue_url = sqs.get_queue_url(QueueName=queue_name)['QueueUrl']
            receipt_handle = record['receiptHandle']
            sqs.delete_message(
                QueueUrl=source_queue_url,
                ReceiptHandle=receipt_handle
            )
        except Exception as e:
            logger.error(f"Error procesando mensaje: {str(e)}", exc_info=True)

def json_default(obj):
    if isinstance(obj, Decimal):
        return int(obj) if obj % 1 == 0 else float(obj)
    
    if isinstance(obj, (datetime.date, datetime.datetime)):
        return obj.isoformat()  # Convierte datetime a formato ISO 8601
    raise TypeError(f"Object of type {obj.__class__.__name__} is not JSON serializable")
