---
layout: post
title: A Week of Podcasts
category: blog
tag: Data Visualization
tagline: For FiveThirtyEight's What's the Point
thumbnail: /assets/blog/a_week_of_podcasts/a_week_of_podcasts-4.png
---

As some of my friends may know, I'm a bit of a podcast fiend and a data nut. So, naturally, one of my favorite podcasts is FiveThirtyEight's "What's the Point". [This week's episode](http://fivethirtyeight.com/features/dear-data-and-fivethirtyeight-want-you-to-visualize-your-podcast-habits/) dug into the [Dear Data project](http://www.dear-data.com/by-week/) in which a pair of data visualization professionals exhanged weekly postcards with hand-drawn data renderings for a year. Much of their work centered around the activities of daily life, from laughter to indecision. Near the end of the episode, they challenged listeners to track a week's worth of their own podcast listening habits, visualize them on a postcard, and send them in.

Given my previous dabbling in quantified self efforts, I was excited to take on the challenge. And I found the limited scope and defined time period attractive. Many of my previous efforts went off the rails through a combination of the tedium of data collection coupled with distracting heaps of data to be dug into. Unsure of how I wanted to visualize the data, I decided to be detailed in my data recording efforts to ensure I had too much data, rather than too little. Below is a sample data point.

	{
		"date" : "2016-03-14",
		"startTime" : "18:21",
		"endTime" : "19:45",
		"podcast" : "Adam Carolla Show",
		"device" : "iPhone",
		"mode" : "Headphones",
		"activity" : "Lifting",
		"location" : "Gym"
	}

After some test plots to get a better feel for the data, I elected to focus on time of day, length of listening session, location while listening, and the specific podcast being played. While I typically approach visualizations focused on clarity and simplicity, this challenge (and its inspiration) begged for a more abstract/artistic approach, especially since I'd elected not to do the visualization by hand. With that in mind, I took a first pass with the following visual encodings:

* The x-axis is time of day, from midnight to midnight, while the y-axis represents listening locations. From bottom to top: home, local driving, gym, highway driving.
* The colored shapes have uniform height, with x-axis widths spanning from start time to end time and y-position centered on location. The colored fills represent specific podcasts.
* The lines connecting the dots each represent one day of the week of collected data.

![](/assets/blog/a_week_of_podcasts/a_week_of_podcasts-1.png)

While this first plot was interesting, it lacked clarity. One of the biggest problems was the overlapping bubbles -- they became muddled and confusing due to their distorted shapes and blending colors. The lines representing days of the week also proved more distracting than useful. To address these issues, I swapped the eliptical bubbles for circles, and set each day's line to share origin and termination points off the edge of the plot to avoid confusing them with the dot grid axes.

![](/assets/blog/a_week_of_podcasts/a_week_of_podcasts-2.png)

This was definitely a step in the right direction, but the y-axis location encoding seemed ineffective, and, while the overlaps were good at showing clustered listening times, color blending was still obscuring podcast data. I decided it was time to swap days and location, mapping days to the y-axis to create a more traditional calendar view. With only four locations to now map to the scattered bubbles, the logical choice was to run traces from each corner, which proved remarkably effective at demonstrating additional clustering. For my sanity (and yours), I finally added labels and a legend to the graph, figuring I could just convert them into a guide graphic when ready to print the postcard.

![](/assets/blog/a_week_of_podcasts/a_week_of_podcasts-3.png)

We have a winner. Aside from tweaking some colors and opacities, I felt this third attempt was an elegant enough solution to run with. The date/time encoding is clear and simple, allowing readers to quickly identify time clustering patterns across days without the podcast data being obscured. And, after a few passes at mapping locations to different corners, this version was untangled enough to clearly read additional patterns.

After making those tweaks, here's how the final version (digital and printed) turned out:

![](/assets/blog/a_week_of_podcasts/a_week_of_podcasts-4.png)
![](/assets/blog/a_week_of_podcasts/a_week_of_podcasts-5.png)

	Will update with pictures of printed cards

For those interested, I used [Processing](http://processing.org) for all of my visualization work. My code is a little long and convoluted, but [here is the full source code](https://github.com/bdharva/processing/tree/master/podcasts) used to generate the graphic, along with the JSON data file containing my week of podcast listening data. I was a little rusty with Processing and I'm certain I have room for improvement as a programmer, but this proved good enough for what I was trying to accomplish.
