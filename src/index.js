'use strict';

import 'dotenv/config';
import express from 'express';
import axios from 'axios';
import { registerMediator } from 'openhim-mediator-utils';
import mediatorConfig from './config/mediatorConfig.json' assert { type: 'json' };

const openhimConfig = {
    username: process.env.OPENHIM_USERNAME,
    password: process.env.OPENHIM_PASSWORD,
    apiURL: process.env.OPENHIM_API_URL,
    trustSelfSigned: process.env.OPENHIM_TRUST_SELF_SIGNED
};

registerMediator(openhimConfig, mediatorConfig, err => {
    if (err) {
        console.error('Failed to register mediator. Check your Config:', err);
        process.exit(1);
    }
});

const app = express();
app.use(express.json());

let access_token = '';
let token_expiry_time = 0;

const authenticate = async () => {
    try {
        const authResponse = await axios.post(
            `${process.env.KEYCLOACK_URL}`,
            {   
                grant_type: 'password',
                username: process.env.GOFR_USERNAME, 
                password: process.env.GOFR_PASSWORD, 
                client_id: 'gofr-api',
                client_secret: 'df3dcc28-f79f-4df7-bd5c-427afe60a41b' 
            },
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',  
                }
            }
        );
        
        const auth_data = authResponse.data;
        if (auth_data && auth_data.access_token) {
            access_token = auth_data.access_token;
            token_expiry_time = Date.now() + auth_data.expires_in * 1000;
        } else {
            throw new Error('No access_token returned from authentication');
        }
    } catch (error) {
        console.error('Login Error:', error.response ? error.response.data : error.message);
        throw error; 
    }
};

const isTokenExpired = () => {
    return Date.now() >= token_expiry_time;
};

app.all('*', async (req, res) => {
    try {
        if (isTokenExpired() || !access_token) {
            await authenticate();
        }

        const gofrResponse = await axios({
            method: req.method,
            url: `${process.env.GOFR_API_URL}/fhir${req.originalUrl}`,
            headers: {
                'Authorization': `Bearer ${access_token}`,
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

        // Si une erreur 401 se produit, je réinitialise le access_token et je retente l'authentification
        if (error.response && error.response.status === 401) {
            access_token = '';
            try {
                await authenticate();
                const retryResponse = await axios({
                    method: req.method,
                    url: `${process.env.GOFR_API_URL}/fhir${req.originalUrl}`,
                    headers: {
                        'Authorization': `Bearer ${access_token}`,
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
