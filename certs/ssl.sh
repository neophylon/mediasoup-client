#!/bin/bash
openssl req -nodes -x509 -newkey rsa:4096 -keyout ./privkey.pem -out ./fullchain.pem -sha256 -days 365