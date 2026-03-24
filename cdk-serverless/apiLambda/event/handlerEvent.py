import json
import boto3
import uuid
import os
import time

allowed_methods = {"GET", "POST", "PUT", "DELETE", "OPTIONS"}
http_method_handlers = {}
source = 'hl.app.events'

# Decorator
def register_http_method(method: str):
    def decorator(func):
        http_method_handlers[method] = func  # UPPERCASE
        return func
    return decorator

@register_http_method("GET-CARS")
def handle_get_cars(request_id, message, params=None):
    data = {}
    print("Params received in GET-CARS handler:", params)  # Debugging line
    mtype = 'getCars'
    if params:
        if 'name' in params:
            data = {'name': validateParameter(params['name'])}

    send_message_to_eventbridge(data, mtype, request_id)


def send_message_to_eventbridge(message, mtype, request_id):
    client = boto3.client('events')
    response = client.put_events(
        Entries=[
            {
                'Source': source,
                'DetailType': 'message-for-queue',
                'Detail': json.dumps({
                    'message': message,
                    'messageType': mtype, 
                    'request_id': request_id
                    }),
                'EventBusName': 'HL-bus'
            },
        ]
    )
    
def wait_for_response(request_id):
    try:
        sqs = boto3.client('sqs')
        response_queue_url = os.getenv('HL_RESPONSE_QUEUE_URL')

        while True:
            try:
                response = sqs.receive_message(QueueUrl=response_queue_url, MaxNumberOfMessages=5)
                messages = response.get('Messages', [])

                timeout = 60  # Duración máxima de espera en segundos
                start_time = time.time()
                for message in messages:
                    body = json.loads(message['Body'])
                    if isinstance(body, dict) and body['request_cid'] == request_id: # If correlation id equals
                        sqs.delete_message(QueueUrl=response_queue_url, ReceiptHandle=message['ReceiptHandle'])
                        return body['query_result']

                    if time.time() - start_time > timeout:
                        return {'error': 'Tiempo de espera excedido'}

            except Exception as e:
                print(f"Error al recibir mensaje de SQS: {e}")
                return {'error': f'Error al recibir mensaje de SQS: {str(e)}'}
    except Exception as e:
        print(f"Error al inicializar SQS: {e}")
        return {'error': f'Error al inicializar SQS: {str(e)}'}
    
def validateParameter(value):
    try:
        id_value = int(value) 
        return id_value
    except ValueError:
        raise ValueError("valor inválido")
    
def main(event, context):
    request_id = str(uuid.uuid4())
    path_parameters = event.get("pathParameters", {}) 
    path = event.get("path", {}).lstrip('/')
    data = event.get("body", "{}")
    try:
        message = json.loads(data)
    except:
        message = {}

    method = event.get("httpMethod", "UNKNOWN")
    if method not in allowed_methods:
        return {
            "statusCode": 405,
            "body": f"Method {method} is not allowed."
        }
    
    endpoint = '-'.join([method,path]).split('/')[0].upper()
    handler = http_method_handlers.get(endpoint)
    try:
        handler(request_id, message, path_parameters)
    except Exception as e:
        print(f"Error en handler al enviar el mensaje a EventBridge: {e}")
        return {
            'statusCode': 500,
            'body': json.dumps(f'Error al procesar la solicitud: {str(e)}')
        }
    
    # Esperar mensaje en la cola de respuestas
    response_message = wait_for_response(request_id)

    origin = event['headers'].get('origin', '')
    allowed_origins = os.environ.get('ALLOWED_ORIGINS', '[]')

    if origin in allowed_origins:
        access_control_origin = origin
    else:
        access_control_origin = 'null'

    return {
        'statusCode': 200,
        'body': json.dumps(response_message),
        'headers': {
            'Access-Control-Allow-Origin': access_control_origin,
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Content-Type': 'application/json'
        },
    }
