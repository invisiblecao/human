const express = require('express');
const bodyParser = require('body-parser');
const Human = require('@vladmandic/human').default;
const tf = require('@tensorflow/tfjs-node');

const app = express();
const port = 3000;

// Configure the Human library with necessary options
const human = new Human({
    backend: 'tensorflow',
    modelBasePath: 'file:///Users/caokepan/Desktop/human/models',  // Update this path
    face: { enabled: true, detector: { rotation: true } },
    body: { enabled: false },
    hand: { enabled: false }
});

// Middleware to handle JSON data
app.use(bodyParser.json({ limit: '50mb' }));

// Asynchronously load models and start the server
async function loadModels() {
    try {
        await human.load();
        console.log('Human models loaded successfully');
        // Start the server after models are loaded
        app.listen(port, () => {
            console.log(`Server running on http://localhost:${port}`);
        });
    } catch (error) {
        console.error('Error loading Human models:', error);
        process.exit(1); // Exit if models can't be loaded
    }
}

// Endpoint to process frames
app.post('/frame', async (req, res) => {
    try {
        const image = req.body.image; // Base64-encoded image
        const buffer = Buffer.from(image, 'base64');
        const tensor = tf.node.decodeImage(buffer, 3);
        const result = await human.detect(tensor);
        tensor.dispose(); // Free memory
        res.json(result);
    } catch (error) {
        console.error('Error processing image:', error);
        res.status(500).send('Error processing image');
    }
});

// Initialize model loading and server
loadModels();
