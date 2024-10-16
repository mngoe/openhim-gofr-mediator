'use strict';

import express from 'express';
import axios from 'axios';
import { registerMediator } from 'openhim-mediator-utils';
import mediatorConfig from './mediatorConfig.json' assert { type: 'json' };

const openhimConfig = {
    username: 'root@openhim.org',
    password: 'live123',
    apiURL: 'https://192.168.1.110:8082',
    trustSelfSigned: true
};

registerMediator(openhimConfig, mediatorConfig, err => {
    if (err) {
        console.error('Failed to register mediator. Check your Config:', err);
        process.exit(1);
    }
});

const app = express();
app.use(express.json());

let sessionCookie = '';

const authenticate = async () => {
    try {
        const authResponse = await axios.post(
            'http://192.168.1.110:4000/auth/login',
            { username: "root@gofr.org", password: "gofr" },
            {
                headers: {
                    'Content-Type': 'application/json',
                }
            }
        );
        
        const cookies = authResponse.headers['set-cookie'];
        if (cookies) {
            sessionCookie = cookies.find(cookie => cookie.startsWith('connect.sid='));
            // console.log('Session Cookie:', sessionCookie);
        } else {
            throw new Error('No cookie returned from authentication');
        }
    } catch (error) {
        console.error('Login Error:', error.response ? error.response.data : error.message);
        throw error; 
    }
};

app.all('*', async (req, res) => {
    try {
        if (!sessionCookie) {
            await authenticate();
        }

        const gofrResponse = await axios({
            method: req.method,
            url: `http://192.168.1.110:4000/fhir/DEFAULT${req.originalUrl}`,
            headers: {
                'Cookie': sessionCookie || '',
                ...(req.method === 'POST' && { 'Content-Type': 'application/json' }),
            },
            data: req.method === 'POST' ? req.body : undefined
        });

        res.status(gofrResponse.status).json(gofrResponse.data);
    } catch (error) {
        console.error('Error:', error.response ? error.response.data : error.message);
        if (error.response) {
            console.error('Response Headers:', error.response.headers);
            console.error('Response Status:', error.response.status);
        }

        // Si une erreur 401 se produit, je réinitialiser le cookie et je retente l'authentification
        if (error.response && error.response.status === 401) {
            sessionCookie = '';
            try {
                await authenticate();
                const retryResponse = await axios({
                    method: req.method,
                    url: `http://192.168.1.110:4000/fhir/DEFAULT${req.originalUrl}`,
                    headers: {
                        'Cookie': sessionCookie || '',
                        ...(req.method === 'POST' && { 'Content-Type': 'application/json' }),
                    },
                    data: req.method === 'POST' ? req.body : undefined
                });
                return res.status(retryResponse.status).json(retryResponse.data);
            } catch (retryError) {
                console.error('Retry Error:', retryError.response ? retryError.response.data : retryError.message);
                return res.status(retryError.response ? retryError.response.status : 500).send(retryError.message);
            }
        }

        res.status(error.response ? error.response.status : 500).send(error.message);
    }
});

app.listen(3000, '0.0.0.0', () => {
    console.log('Server listening on port 3000...');
});