---
layout: post
title: Make some noise( ) in Processing
category: blog
tags:
- Programming
- Processing
tagline: Creating pretty pixels with Perlin noise
thumbnail: /assets/blog/processing_perlin_noise/processing_perlin_noise-3.png
---

While I'm a frequent user of Processing, I mostly use it for generating data visualizations. As a result, I'm generally using a very limited subset of its capabilities. From time to time I like to explore the documentation for cool features that I haven't had the opportunity to use. Recently, the `noise()` function caught my eye.

From the [Processing documentation](https://processing.org/reference/noise_.html):

> Perlin noise is a random sequence generator producing a more natural, harmonic succession of numbers than that of the standard random() function. It was developed by Ken Perlin in the 1980s and has been used in graphical applications to generate procedural textures, shapes, terrains, and other seemingly organic forms.

This sounded pretty cool to me. As I started imagining what sort of textures I might be able to create, I decided to start with a take on the popular "low poly" wallpapers I'd seen in my travels around the web. To keep things simple (and stay focused on `noise()`), I tessalated an array of equilateral triangles for the visual, rather than using random vertices. The traingles were colored using the `noise()` value at their center point to scale the `g` value in their `rgb()` color between 100 and 200, while holding `r` and `b` fixed at 50 and 100, respectively.

	int width = 1200;
	int height = 800;

	void setup() {

	  size(width, height);
	  colorMode(RGB, 255);
	  poly();

	}

	void draw() {}

	void poly() {

	  int size = 25;
	  float noiseScale = .01;
	  rectMode(CORNER);

	  for (int x=0; x<width+100; x+=size) {

	    for (int y=0; y<height+100; y+=2*size*sin(PI/3)) {

	      for (int t=0; t<12; t+=2) {

	        float noiseVal = 100+100*noise((x+size/2*cos((t+1)*PI/6))*noiseScale, (y+size/2*sin((t+1)*PI/6))*noiseScale);
	        fill(50, noiseVal, 100);
	        noStroke();
	        triangle(x, y, x+size*cos(t*PI/6), y+size*sin(t*PI/6), x+size*cos((t+2)*PI/6), y+size*sin((t+2)*PI/6));

	      }

	    }

	  }

	  save("poly.png");

	}

![](/assets/blog/processing_perlin_noise/processing_perlin_noise-1.png)

Next I decided to try breaking the resulting gradient into hard steps. To accomplish this, I scaled `noise()` by the number of steps and rounded it to a whole number. Given that it returns a value between zero and one, this yielded scaled values from 0 to `steps` that could then be used to incrementally step between defined start and stop `rgb()` values.

	void poly2() {

	  int size = 10;
	  float noiseScale = .01;
	  int steps = 10;
	  int baseR = 150;
	  int stopR = 230;
	  int baseG = 0;
	  int stopG = 230;
	  int baseB = 0;
	  int stopB = 0;

	  for (int x=0; x<width+100; x+=size) {

	    for (int y=0; y<height+100; y+=2*size*sin(PI/3)) {

	      for (int t=0; t<12; t+=2) {

	        float noiseVal = steps*noise((x+size/2*cos((t+1)*PI/6))*noiseScale, (y+size/2*sin((t+1)*PI/6))*noiseScale);
	        noiseVal = round(noiseVal);
	        fill(baseR+noiseVal*(stopR-baseR)/steps, baseG+noiseVal*(stopG-baseG)/steps, baseB+noiseVal*(stopB-baseB)/steps);
	        noStroke();
	        triangle(x, y, x+size*cos(t*PI/6), y+size*sin(t*PI/6), x+size*cos((t+2)*PI/6), y+size*sin((t+2)*PI/6));

	      }

	    }

	  }

	  save("poly2.png");

	}

![](/assets/blog/processing_perlin_noise/processing_perlin_noise-2.png)

Content with my "low poly wallpaper" and "hot lava" results, it was time to try for a more photorelaistic texture - a cloudy sky. It took some fiddling to get the right look, but I'm pleased with the results. In addition to switching to smaller square regions, you'll notice I adjusted the scaling factor for `noise()`. The [documentation](https://processing.org/reference/noise_.html) indicates that "steps of 0.005-0.03 work best for most applications", and, through all of my trials, I found this to be true. For this particular example, I just tweaked it until I got the "right look".

	void poly3() {

	  int size = 5;
	  float noiseScale = .005;
	  rectMode(CORNER);

	  for (int x=0; x<width+100; x+=size) {

	    //for (int y=0; y<height+100; y+=2*size*sin(PI/3)) {
	    for (int y=0; y<height+100; y+=size) {

	      for (int t=0; t<12; t+=2) {

	        float noiseVal = noise((x+size/2*cos((t+1)*PI/6))*noiseScale, (y+size/2*sin((t+1)*PI/6))*noiseScale);

	        fill(noiseVal*250, 100+noiseVal*150, 250);
	        noStroke();
	        rect(x, y, size, -size);

	      }

	    }

	  }

	  save("poly3.png");

	}

![](/assets/blog/processing_perlin_noise/processing_perlin_noise-3.png)

My final texture experiment was with a digital camo of sorts. Earlier this year I was gifted an Under Armour fishing shirt with a really neat rasterized camo pattern. I figured attempting to recreate it would be more interesting than a traditional square-pixeled digital camo pattern. What I came up with is not a perfect recreation, but it was close enough to make me happy. I'm sure I could get closer with a little more work, but, unfortunately, I don't have the luxury of being able to play with Processing *all* day (yet!).

![](/assets/blog/processing_perlin_noise/processing_perlin_noise-4.png)

Using two base colors, I created a checkerboard pattern to cover the canvas. Then, on top of each square, I created another square of the other color. These squares and their corner radii were scaled with the `noise()` value for the first color and inversely scaled for the other to maintain a smooth flow of "dominant color" across cells.

	void poly4() {

	  int size = 8;
	  float noiseScale = .02;
	  rectMode(CENTER);
	  background(229,255,128);

	  for (int x=0; x<=width; x+=size) {

	    for (int y=0; y<=height; y+=size) {

	      float noiseVal = noise(x/2.5*noiseScale, y*noiseScale);
	      noStroke();

	      float radius;

	      if (((x/size)+(y/size))%2 == 0) {

	        radius = noiseVal*size;

	        fill(83,108,103);
	        rect(x, y, size, size);
	        fill(229,255,128);
	        rect(x, y, noiseVal*size, noiseVal*size, radius, radius, radius, radius);

	      } else {

	        radius = (1-noiseVal)*size;

	        fill(229,255,128);
	        rect(x, y, size, size);
	        fill(83,108,103);
	        rect(x, y, (1-noiseVal)*size, (1-noiseVal)*size, radius, radius, radius, radius);

	      }

	    }

	  }

	  save("poly4.png");

	}

![](/assets/blog/processing_perlin_noise/processing_perlin_noise-5.png)

And there you have it. Thanks to `noise()`, just a few simple lines of code can generate a number of interesting textures and patterns. In the future, I may be tempted to refine this camo pattern for a vinyl wrap for my truck.

You can check out the full source code from these examples on Github.
