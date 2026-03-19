#!/usr/bin/env node
/*--------------------------------------------------------------------------------------------------------------------*/

import crypto from 'node:crypto';

import express from 'express';

/*--------------------------------------------------------------------------------------------------------------------*/

import {RESP_TYPES, createClient} from 'redis';

/*--------------------------------------------------------------------------------------------------------------------*/

const redis = createClient({url: 'redis://127.0.0.1:6379'}).withTypeMapping({
    [RESP_TYPES.BLOB_STRING]: Buffer,
});

redis.on('error', (error) => {

    console.error('Redis error:', error);
});

await redis.connect();

/*--------------------------------------------------------------------------------------------------------------------*/

const BASE_URLS = [
    'https://alasky.cds.unistra.fr/hips-image-services/hips2fits',
    'https://alaskybis.cds.unistra.fr/hips-image-services/hips2fits',
];

/*--------------------------------------------------------------------------------------------------------------------*/

function buildCacheKey(query)
{
    const normalized = [
        String(query.ra),
        String(query.dec),
        String(query.fov),
        String(query.width),
        String(query.height),
    ].join('|');

    const hash = crypto.createHash('sha256')
                       .update(normalized)
                       .digest('hex')
    ;

    return `hips2fits:${hash}`;
}

/*--------------------------------------------------------------------------------------------------------------------*/

function buildRemoteUrl(baseUrl, query)
{
    const url = new URL(baseUrl);

    url.searchParams.set('hips', 'CDS/P/DSS2/color');
    url.searchParams.set('projection', 'TAN');
    url.searchParams.set('format', 'jpg');

    url.searchParams.set('ra', String(query.ra));
    url.searchParams.set('dec', String(query.dec));
    url.searchParams.set('fov', String(query.fov));
    url.searchParams.set('width', String(query.width));
    url.searchParams.set('height', String(query.height));

    return url.toString();
}

/*--------------------------------------------------------------------------------------------------------------------*/

async function fetchRemoteImage(query)
{
    const firstIndex = Math.floor(Math.random() * BASE_URLS.length);

    for(let i = 0; i < BASE_URLS.length; i++)
    {
        const baseUrl = BASE_URLS[(firstIndex + i) % BASE_URLS.length];

        try
        {
            const response = await fetch(buildRemoteUrl(baseUrl, query));

            if(response.ok)
            {
                return response;
            }

            console.error(`Remote server error for ${baseUrl}: ${response.status}`);
        }
        catch(error)
        {
            console.error(`Fetch failed for ${baseUrl}: ${error}`);
        }
    }

    return null;
}

/*--------------------------------------------------------------------------------------------------------------------*/

const app = express();

/*--------------------------------------------------------------------------------------------------------------------*/

app.get('/api/hips2fits', async (req, res) => {
    try
    {
        /*------------------------------------------------------------------------------------------------------------*/

        const ra = Number(req.query.ra);
        const dec = Number(req.query.dec);
        const fov = Number(req.query.fov);
        const width = Number(req.query.width);
        const height = Number(req.query.height);

        if(!Number.isFinite(ra)
           ||
           !Number.isFinite(dec)
           ||
           !Number.isFinite(fov)
           ||
           !Number.isFinite(width)
           ||
           !Number.isFinite(height)
        ) {
            res.status(400).send('Invalid query parameters');

            return;
        }

        const query = {
            ra: ra,
            dec: dec,
            fov: fov,
            width: width,
            height: height,
        };

        /*------------------------------------------------------------------------------------------------------------*/

        const cacheKey = buildCacheKey(query);

        /*------------------------------------------------------------------------------------------------------------*/

        const cached = await redis.sendCommand(['GET', cacheKey], {
            returnBuffers: true,
        });

        if(cached != null)
        {
            res.setHeader('Content-Type', 'image/jpeg');
            res.setHeader('Content-Length', String(cached.length));
            res.setHeader('X-Cache', 'HIT');
            res.send(cached);

            return;
        }

        /*------------------------------------------------------------------------------------------------------------*/

        const response = await fetchRemoteImage(query);

        if(response == null)
        {
            res.status(502).send('Remote server error');

            return;
        }

        /*------------------------------------------------------------------------------------------------------------*/

        const arrayBuffer = await response.arrayBuffer();

        const buffer = Buffer.from(arrayBuffer);

        await redis.set(cacheKey, buffer, {
            EX: 86400,
        });

        res.setHeader('Content-Type', 'image/jpeg');
        res.setHeader('Content-Length', String(buffer.length));
        res.setHeader('X-Cache', 'MISS');
        res.send(buffer);

        /*------------------------------------------------------------------------------------------------------------*/
    }
    catch(error)
    {
        console.error(error);

        res.status(500).send('Internal server error');
    }
});

/*--------------------------------------------------------------------------------------------------------------------*/

app.listen(3999, () => {

    console.log('Server listening on port 3999');
});

/*--------------------------------------------------------------------------------------------------------------------*/
