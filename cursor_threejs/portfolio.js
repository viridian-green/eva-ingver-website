const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let birds = [];
const birdConfig = {
    numBirds: 6,
    maxDistance: 600,
    desiredSeparation: 90,
    maxSpeed: 0.55,
    maxForce: 0.003,
    seekWeight: 0.8,
    separationWeight: 0.9,
    drag: 0.985,
    maxRotationSpeed: 0.006,
};

const imagePaths = ['bird1.png', 'bird2.png', 'bird3.png', 'bird4.png', 'bird6.png'];

function loadImages() {
    return Promise.all(imagePaths.map(path => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.src = path;
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error(`Failed to load image at ${path}`));
        });
    }));
}

class Bird {
    constructor(x, y, image) {
        this.position = { x: x, y: y };
        this.velocity = {
            x: (Math.random() * 2 - 1) * birdConfig.maxSpeed,
            y: (Math.random() * 2 - 1) * birdConfig.maxSpeed,
        };
        this.acceleration = { x: 0, y: 0 };
        this.size = 75;
        this.image = image;
        this.maxForce = birdConfig.maxForce;
        this.maxSpeed = birdConfig.maxSpeed;
        this.angle = 0;
        this.maxRotationSpeed = birdConfig.maxRotationSpeed;
    }

    applyForce(force) {
        this.acceleration.x += force.x;
        this.acceleration.y += force.y;
    }

    seek(target) {
        let desired = {
            x: target.x - this.position.x,
            y: target.y - this.position.y
        };
        let mag = Math.sqrt(desired.x * desired.x + desired.y * desired.y);
        if (mag > 0) {
            desired.x = (desired.x / mag) * this.maxSpeed;
            desired.y = (desired.y / mag) * this.maxSpeed;
        }
        let steer = {
            x: desired.x - this.velocity.x,
            y: desired.y - this.velocity.y
        };
        steer.x = Math.min(Math.max(steer.x, -this.maxForce), this.maxForce);
        steer.y = Math.min(Math.max(steer.y, -this.maxForce), this.maxForce);
        return steer;
    }

    separate(birds) {
        let steer = { x: 0, y: 0 };
        let count = 0;
        for (let other of birds) {
            if (other !== this) {
                let dx = this.position.x - other.position.x;
                let dy = this.position.y - other.position.y;
                let distance = Math.sqrt(dx * dx + dy * dy);
                if (distance < desiredSeparation && distance > 0) {
                    let force = {
                        x: dx / distance,
                        y: dy / distance
                    };
                    steer.x += force.x;
                    steer.y += force.y;
                    count++;
                }
            }
        }
        if (count > 0) {
            steer.x /= count;
            steer.y /= count;
            let mag = Math.sqrt(steer.x * steer.x + steer.y * steer.y);
            if (mag > 0) {
                steer.x = (steer.x / mag) * this.maxSpeed;
                steer.y = (steer.y / mag) * this.maxSpeed;
                steer.x -= this.velocity.x;
                steer.y -= this.velocity.y;
                steer.x = Math.min(Math.max(steer.x, -this.maxForce), this.maxForce);
                steer.y = Math.min(Math.max(steer.y, -this.maxForce), this.maxForce);
            }
        }
        return steer;
    }

    update(target, isLeader, birds) {
        let seekForce = this.seek(isLeader ? target : target.position);
        let separateForce = this.separate(birds);

        seekForce.x *= birdConfig.seekWeight;
        seekForce.y *= birdConfig.seekWeight;
        separateForce.x *= birdConfig.separationWeight;
        separateForce.y *= birdConfig.separationWeight;

        this.applyForce(seekForce);
        this.applyForce(separateForce);

        this.velocity.x += this.acceleration.x;
        this.velocity.y += this.acceleration.y;
        this.velocity.x *= birdConfig.drag;
        this.velocity.y *= birdConfig.drag;

        let speed = Math.sqrt(this.velocity.x * this.velocity.x + this.velocity.y * this.velocity.y);
        if (speed > this.maxSpeed) {
            this.velocity.x = (this.velocity.x / speed) * this.maxSpeed;
            this.velocity.y = (this.velocity.y / speed) * this.maxSpeed;
        }

        this.position.x += this.velocity.x;
        this.position.y += this.velocity.y;

        this.acceleration.x = 0;
        this.acceleration.y = 0;

        if (this.position.x > canvas.width) this.position.x = 0;
        else if (this.position.x < 0) this.position.x = canvas.width;
        if (this.position.y > canvas.height) this.position.y = 0;
        else if (this.position.y < 0) this.position.y = canvas.height;

        // New code for smooth rotation
        let desiredAngle = Math.atan2(this.velocity.y, this.velocity.x) + Math.PI/2;
        let angleDiff = desiredAngle - this.angle;
        angleDiff = (angleDiff + Math.PI * 3) % (Math.PI * 2) - Math.PI;
        let rotation = Math.max(-this.maxRotationSpeed, Math.min(this.maxRotationSpeed, angleDiff));
        this.angle += rotation;

        this.draw();
    }

    draw() {
        ctx.save();
        ctx.translate(this.position.x, this.position.y);
        ctx.rotate(this.angle);
        ctx.drawImage(this.image, -this.size / 2, -this.size / 2, this.size, this.size);
        ctx.restore();
    }
}

function animate(mousePos) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    let closestBirdIndex = null;
    let closestDistance = Infinity;

    for (let i = 0; i < birds.length; i++) {
        const dx = mousePos.x - birds[i].position.x;
        const dy = mousePos.y - birds[i].position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < closestDistance) {
            closestDistance = distance;
            closestBirdIndex = i;
        }
    }

    for (let i = 0; i < birds.length; i++) {
        if (i === closestBirdIndex) {
            birds[i].update(mousePos, true, birds);
        } else {
            let leaderBird = birds[closestBirdIndex];
            birds[i].update(leaderBird, false, birds);
        }
    }

    requestAnimationFrame(() => animate(mousePos));
}

let mousePos = { x: canvas.width / 2, y: canvas.height / 2 };
canvas.addEventListener('mousemove', (event) => {
    mousePos.x = event.clientX;
    mousePos.y = event.clientY;
});

loadImages().then(images => {
    for (let i = 0; i < birdConfig.numBirds; i++) {
        birds.push(new Bird(Math.random() * canvas.width, Math.random() * canvas.height, images[i % images.length]));
    }
    animate(mousePos);
}).catch(error => console.error('Error loading images:', error));