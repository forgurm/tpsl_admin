const express = require('express');
const router = express.Router();
const Event = require('../models/event');

router.get('/events', async (req, res) => {
    const events = await Event.findAll();
    res.json(events);
});

router.post('/events', async (req, res) => {
    const { title, start, end } = req.body;
    const event = await Event.create({ title, start, end });
    res.json(event);
});

module.exports = router;
