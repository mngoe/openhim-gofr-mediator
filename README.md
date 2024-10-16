
# OpenHIM Gofr Mediator

This mediator enables the authentication of requests sent to Gofr using a session cookie obtained from OpenHIM.

## Starting the OpenHIM Gofr Mediator

Before launching this mediator, ensure you have the following set up:

### Required Instances

- An instance of OpenHIM-Core
- An instance of OpenHIM-Console
- A MongoDB instance

### OpenHIM User Account

- A user account with the necessary permissions to access the API.

### OpenHIM Client Configuration

- A configured OpenHIM client, including clientId and password.

## Configuration

- Replace host addresses, ports, and login credentials with your own.

## Starting the Mediator with Docker

To start the bootstrap mediator, open a terminal, navigate to the project directory, and run the following commands:

1. Build the Docker image:
    docker build -t gofr-mediator 

2. Check the available Docker networks:
    docker network ls

3. Run the container:
    docker run --network {openhim-network} --name gofr-mediator --rm -p 3000:3000 gofr-mediator

## Configuration in OpenHIM

In the OpenHIM Console, navigate to the mediators section, select the mediator, and then install the channel.

## Sending Requests

To make a basic GET request, open a terminal (or Postman) and run the GET command with your OpenHIM client credentials.
