---
layout: d3post
title: Sales Mapping with D3
category: blog
tag: "Data Visualization"
tagline: How to use the US census API to add context to mapped sales data
thumbnail: /assets/blog/d3-mapping-sales/screenshot2.png
script: /assets/blog/d3-mapping-sales/chart.js
stylesheet: /assets/blog/d3-mapping-sales/chart.css
---

As we've continued to grow [Jolt](http:joltsensor.com), we've found it useful to build internal tools for tracking sales and engagement. Specifically, identifying and monitoring key geographies where we're doing well helps in understanding our customers and targeting new ones. In this example, I'll share how we make a bubble map of sales volume by US zip code. The bubbles are scaled proportionally to the total profit for the area and centered on the centroid of the zip code region.

<div id="chart">
	<div id="pane-1" class="pane">
	</div>
	<div id="pane-2" class="pane">
	</div>
</div>

The inspiration for this map was Mike Bostock's tutorial [Let's Make a Bubble Map](https://bost.ocks.org/mike/bubble-map/), however we put in some additional work on data collection and cleaning, interactive tooltips for exploring the data, and making everything responsive. Here's the general process that we followed to make the map above:

* Export a sampling of recent sales data from [Celery](https://www.trycelery.com/) and a sampling of backers from [our Kickstarter campaign](http://joltsensor.com/kickstarter)
* Use a [Python](https://www.python.org/) script to aggregate this data by zip code and combine it with demographic data for each zip code pulled from the [US Census API](http://www.census.gov/data/developers/data-sets.html)
* Use a Makefile to download and prepare the proper geographic shapefiles from the US Census Bureau's [TIGER database](https://www.census.gov/geo/maps-data/data/tiger.html)
* Use [D3](https://d3js.org/) to draw the map, plot the zip-code-level data points, and provide interactive ways to explore the data

### Preparing the Data

If you're building a visualization like this into some sort of internal dashboard, it probably makes sense to connect it to an API that serves up fresh data (if you have one available). But for the purposes of this tutorial, I'm going to focus on working with the sales data locally, outputting a final .csv file for D3 to read in.

#### Downloading Sales Data from Celery and Kickstarter

_Skip to the next section if you already have the data you need, already know how to get it, or are getting it from other sources._

Downloading data for Jolt was straightforward. On Kickstarter, navigate to your project, click "Menu" in the upper righthand corner of your project page, and select "View backer report". At the top of this page, there's a link to "Export backer report". It triggers a pop-up that allows you to select the output format. I selected "All Tiers" and "Kickstarter - pledges, surveys, addresses". When you click "Export", it takes a few seconds to prepare the files for download and then displays a "Download" button when ready. After downloading the report, I unzipped it, deleted all but a few rewards tiers I wanted to include, and then copy-pasted their data into a single file. Note that it's important to make sure the files you're combining have the same column headers and order. If they don't you'll want to use a script to merge them properly.

Following our Kickstarter campaign, we used Celery to collect pre-orders and have continued to use it for order collection now that we're shipping. To get export sales data from Celery, simply navigate to your "Orders" page while logged in. Apply whatever filters you'd like (for example, date range and product variant) and click the "Export Orders" button at the upper right of the page. Then select "Export Fulfillment CSV" in the pop-up (since we want address data to work with). This downloads a .csv that's good to go, unless you want to apply additional filters to the data.

#### Initializing Git

Now that you might have some somewhat sensitive company information (along with personal information of your customers) on your machine, it's a good time to set up a `.gitignore` file if you're going to be using [Git](https://git-scm.com/) to manage your work on this project. In your terminal, navigate to the folder where you're keeping your work for this project and run the following command:

	git init

Now, create your `.gitignore` file in the same directory to make sure you don't accidentally check in those sensitive files or other generated files. Mine looked like this:

	.DS_Store
	build
	node_modules
	api_keys.json
	orders.csv
	kickstarter.csv

The `build` and `node_modules` are where references and generated files will be stored that we don't need to track with git, as they can be regenerated at any time. And `api_keys.json` is where I keep my keys for the Census Data API ([get key](http://api.census.gov/data/key_signup.html)) and Google Maps Geocoding API ([get key](https://developers.google.com/maps/documentation/geocoding/get-api-key)) for reference by the Python script that we're about to get into. The file looks like this:

	{
		"google": <API key here in quotes>,
		"census": <API key here in quotes>
	}

#### Processing the Data with Python

If you're going to be copying parts of this Python code verbatim for your own use, make sure you have Python 3 installed on your machine. You can download that [here](https://www.python.org/downloads/). We'll start by importing the modules that we're going to use.

	import urllib.request, ast, csv, json

The `csv` and `json` modules are useful for reading and writing files of those respective types, `urllib` is what we'll be using to make API calls, and `ast` will allow us to parse the responses from those requests into a usable format. The first thing we want to do is to read in the sales data and aggregate order totals by zip code. Before we read it in, we'll define a class that we'll use instances of to store zip code areas and their corresponding data.

	class Area:

		def __init__(self, zipcode, total):
			self.zipcode = zipcode
			self.total = total

		def add_info(self, lat, lng):
			self.lat = lat
			self.lng = lng

		def add_demos(self, queries):
			self.demos = []
			for item in queries:
				self.demos.append(item)

For now, you can ignore the `add_info` and `add_demos` methods, as we won't be using them until we start pulling Google and Census data. The `__init__` method will be invoked automatically by instantiation of a new class instance. Now, after creating an empty array `orders` to hold all of the `Area` instances we'll be creating, we're ready to read in our Kickstarter order data.

	orders = []

	with open('kickstarter.csv', newline='') as csvfile:
	csv_f = csv.reader(csvfile)
	for row in csv_f:
		if row[4] == 'US':
			code = row[19].split('-')[0]
			amount = float(row[8][1:-4])
			if code != '':
				added = False
				for order in orders:
					if order.zipcode == code:
						order.total += amount
						added = True
				if added == False:
					orders.append(Area(code, amount))

What we're doing here is opening the `kickstarter.csv` file and reading through it row by row. We first check index `[4]` to verify that the shipping country is the United States (since that's the only region we're mapping). Then we get the five digit form of the zip code from index `[19]` and parse the order total at index `[8]` into a usable format. Kickstarter exports order totals in the form "$110.00 USD", so `row[8][1:-4]` is how we access everything between "$" and " USD". With the order info extracted, we check to see if there's already an `Area` instance in the `orders` array with a matching zip code. If there is, we increment `order.total` by the amount of the order. If not, we append a new `Area` instance for the zip code to the array.

We import `orders.csv` in the same way, updating the query indexes to match its formatting.

	with open('orders.csv', newline='') as csvfile:
		csv_f = csv.reader(csvfile)
		for row in csv_f:
			if row[30] == 'US':
				code = row[29].split('-')[0]
				amount = float(row[12])
				added = False
				for order in orders:
					if order.zipcode == code:
						order.total += amount
						added = True
				if added == False:
					orders.append(Area(code, amount))

At this point, we have an array `orders` containing an `Area` instance for each zip code that we received an order from, along with the total dollar-value of orders from each locale. Now we're ready to add some context, first using the Google Maps Geocoding API to get the latitude and longitude of each zip code's center point, then using the US Census API to get some basic demographic information on each area. We define a class for each API, each with an `__init__` method to pull in our API key and a `get` method to create a properly formatted API call, execute it, and return the results.

	class ZipInfo:

		def __init__(self, key):
			self.key = key

		def get(self, query, file_type='json'):
			url = 'https://maps.googleapis.com/maps/api/geocode/%s?address=%s&key=%s' % (file_type, query, self.key)
			req = urllib.request.Request(url)
			response = urllib.request.urlopen(req)
			return response.read()

	class Census:

		def __init__(self, key):
			self.key = key

		def get(self, fields, geo, year=2014, dataset='acs5'):
			fields = [','.join(fields)]
			base_url = 'http://api.census.gov/data/%s/%s/profile?get=' % (str(year), dataset)
			query = fields
			for item in geo:
				query.append(item)
			add_url = '&'.join(query)
			key_url = '&key=' + self.key
			url = base_url + add_url + key_url
			req = urllib.request.Request(url)
			response = urllib.request.urlopen(req)
			return response.read()

Next, we read in our API keys from our untracked `api_keys.json` file, store them in variables, use them to instantiate instances of our API classes, and create an array of the demographic queries we'll be passing to the Census API. You can see a full list of the available census data variables for the 5-Year American Community Survey [here](http://api.census.gov/data/2014/acs5/profile/variables.html).

	with open('api_keys.json') as json_data:
		d = json.load(json_data)
		api_key_c = (d['census'])
		api_key_g = (d['google'])

	c = Census(api_key_c)
	z = ZipInfo(api_key_g)

	query_for = [
		'DP05_0001E',	# total population
		'DP05_0017E',	# median age
		'DP05_0032PE',	# race:white (%)
		'DP03_0062E',	# median household income
		'DP02_0064PE',	# bachelors degree (%)
		'DP02_0065PE'	# graduate degree (%)
		]

With everything set up and ready to go, we can now loop through the `orders` array, making two API calls for each zip code. The first returns the latitude and longitude, which we save to each `Area` instance using the `add_info` method we previously created. And the second return our census data queries, which we add using the `add_demos` method.

	for order in orders:
		info = z.get(order.zipcode)
		results = ast.literal_eval(info.decode('utf8'))
		lat = results['results'][0]['geometry']['location']['lat']
		lng = results['results'][0]['geometry']['location']['lng']
		order.add_info(lat, lng)
		info = c.get(query_for, ['for=zip+code+tabulation+area:'+order.zipcode])
		try:
			results = ast.literal_eval(info.decode('utf8'))
		except:
			for x in range(0, len(query_for)):
				demos.append('null')
			order.add_demos(demos)
			continue
		else:
			demos = []
			for x in range(0, len(query_for)):
				demos.append(results[1][x])
			order.add_demos(demos)

Our last step in Python is to save all of this data to a file that we can access with D3. The syntax and process are very similar to when we previously _read_ files, but now we're _writing_ data row by row.

	with open('orders_demos.csv', 'w') as output:
		writer = csv.writer(output, lineterminator='\n')
		writer.writerow(['Zipcode','Profit','Lat','Lng','Population','Median-Age','Race-White','Median-Household-Income','Bachelors-Degree','Graduate-Degree'])
		for order in orders:
			writer.writerow([str(order.zipcode), str(order.total), str(order.lat), str(order.lng), str(order.demos[0]), str(order.demos[1]), str(order.demos[2]), str(order.demos[3]), str(order.demos[4]), str(order.demos[5])])

Save the completed file (we called ours `orders.py`) to your project directory, open your terminal, navigate to the project directory, and execute the following command.

	python3 orders.py

Depending on how much order data you're processing, it may take a little while to run (and you may want to add in some `print()` statements to track its progress). When it finishes, you'll see a new (or updated) `orders_demos.csv` file in your project directory.

### Preparing Map Files

With all of our order/demographic data prepared, we now need the map files to generate the maps that the data will be plotted on.

#### Downloading TopoJSON

From its documentation, "TopoJSON is an extension of GeoJSON that encodes topology". To avoid getting in the weeds and rehashing what others have explained well elsewhere, I'll just say that TopoJSON is how we convert the map shapefiles (geospatial vector data) into JSON that we'll render with D3. To keep things trackable and repeatable, make a `package.json` file that will be used to install dependencies.

	{
		"name": "anonymous",
		"private": true,
		"version": "0.0.1",
		"dependencies": {
			"topojson": "1"
		}
	}

Now run `npm install` in your project directory, and everything you need to work with TopoJSON will be stored in `/node_modules`.

#### Creating the Makefile

Similar to using `package.json`, we'll now create a Makefile rather than executing our next few steps directly in terminal. This makes things easier for us while working on the project, with the additional benefit of better documentation. In your project directory, create a file called `Makefile` with the following contents.

	all: us.json

	clean:
		rm -rf -- us.json build

	.PHONY: all clean

	build/cb_2015_us_state_20m.zip:
		mkdir -p $(dir $@)
		curl -o $@ http://www2.census.gov/geo/tiger/GENZ2015/shp/$(notdir $@)

	build/cb_2015_us_state_20m.shp: build/cb_2015_us_state_20m.zip
		unzip -od $(dir $@) $<
		touch $@

	build/states.json: build/cb_2015_us_state_20m.shp
		node_modules/.bin/topojson \
			-o $@ \
			-- states=$<

	us.json: build/states.json
		node_modules/.bin/topojson-merge \
			-o $@ \
			--in-object=states \
			--out-object=nation \
			-- $<

In the interest of not reinventing the wheel, [Mike Bostock explains](https://bost.ocks.org/mike/bubble-map/#finding-boundaries) what all of this means (and does) as clearly and succinctly as one could. All you need to know here is this: once you've created the `Makefile`, executing `make build` in terminal will create the `us.json` file that you're going to feed D3. And executing `make clean` will delete that file, as well as the `/build` folder containing the downloaded files referenced to build it.

### Mapping the Data

#### Setup

With all of the data prep out of the way, we're _finally_ ready to start building our visualization in D3! While some people will put all of the code for their visualization in a single HTML file, using `<script>` and `<style>` tags, I prefer to break things out into individual files to keep things decluttered. In your project directory, create files `index.html`, `chart.js`, and `main.css`. Start by populating `index.html` with the following:

	<!DOCTYPE html>
	<html>
		<head>
			<meta charset="utf-8">
			<link href='main.css' rel='stylesheet' type='text/css'>
			<link href='https://fonts.googleapis.com/css?family=Roboto:800,600,400,300' rel='stylesheet' type='text/css'>
			<script src="//d3js.org/d3.v3.min.js" charset="utf-8"></script>
			<script src="//d3js.org/d3-queue.v3.min.js"></script>
			<script src="//d3js.org/topojson.v1.min.js"></script>
		</head>
		<body>
			<div id="chart">
				<div id="pane-1" class="pane">
				</div>
				<div id="pane-2" class="pane">
				</div>
			</div>
		</body>
		<script src="chart.js"></script>
	</html>

This creates the empty shells where we'll be rendering our data. If you recall the interactive graphic from the top of this post, `div#pane-1` with the blue top bar is where we put the map, and `div#pane-2` with the red top bar is where we put the census data for a selected zip code.

#### Displaying the Data

Since we want to make our final graphic responsive, the process by which we generate it is modular. One function is called to initialize it, performing all of the setup tasks that we only need to execute a single time. Then another function is called to render the graphic on page load. This function is also called any time the window size changes, updating any parameters linked to it. This all happens seamlessly as the window is scaled, with styling and a few layout tweaks made in CSS. Our modular `charts.js` follows this basic structure.

	var Chart = (function(document,window,d3) {

		<Define variables accessible to all functions>
		<Load data files>

		function init(error, <Data files>) {

			<Setup stuff that we only need to do once>
			render();

		}

		function render() {

			<Stuff we want to update every time the window size changes>

		}

		return {

			render : render

		}

	})(document,window,d3);

	window.addEventListener('resize', Chart.render);

First we define all of the variables we're going to want accessible across functions and use [d3-queue](https://github.com/d3/d3-queue) to asynchronously load all of our data files (in this case, `us.json` and `orders_demos.csv`) before passing that data to our initialization function `init()`. We also define a function `type()` that we'll pass the .csv data to in a moment. It uses the Javascript unary operator `+` to convert the text fields to numbers and returns the converted data.

	var svg, map, csv, proj, path, nation, states, bubbles, tooltip, stats, width, height, padding, radius;

		d3.queue()
			.defer(d3.json, 'us.json')
			.defer(d3.csv, 'orders_demos.csv')
			.await(init);

			function type(data) {

				data.forEach(function(d) {

					d['Profit'] = +d['Profit'];
					d['Lat'] = +d['Lat'];
					d['Lng'] = +d['Lng'];
					d['Population'] = +d['Population'];
					d['Median-Age'] = +d['Median-Age'];
					d['Race-White'] = +d['Race-White'];
					d['Median-Household-Income'] = +d['Median-Household-Income'];
					d['Bachelors-Degree'] = +d['Bachelors-Degree'];
					d['Graduate-Degree'] = +d['Graduate-Degree'];

				});

				return data;

			}

Now our `init()` functions takes in our data files and passes the order data to `type()` to properly format the number fields. We append an `svg` to `div#pane-1` where we'll be drawing the map. We define our geographic projection and path, and append paths to the `svg` for the full shape of the US, as well as the shapes of the individual states. You'll notice that here we pass in the data file and assign classes (for later styling with CSS) for each path but don't yet link our `path` variable to the `"d"` attribute. We'll do this in the `render()` function after updating the projection based on the window size.

	function init(error, us, orders) {

			if (error) return console.error(error);

			map = us;
			csv = type(orders);

			svg = d3.select('#pane-1')
				.append('svg');

			proj = d3.geo.albersUsa()

			path = d3.geo.path();

			nation = svg.append("path")
				.datum(topojson.feature(map, us.objects.nation))
				.attr("class", "land")

			states = svg.append("path")
				.datum(topojson.mesh(map, us.objects.states, function(a, b) { return a !== b; }))
				.attr("class", "border border--state")

Continuing in the `init()` function, we initialize our bubbles and tooltip in the same way, as well as the statistics panel that we put in `div#pane-2`.

	bubbles = svg.selectAll("circle")
		.data(csv)
		.enter()
		.append("circle")
			.attr("class", "bubble")
			.attr("class", function(d) {
				return "bubble bubble-" + d.Zipcode.substring(0,1);
			})

		bubbles.sort(function(a, b) { return b.Profit - a.Profit; })

		tooltip = d3.select("body")
			.append("div")
			.attr("class", "tooltip")
			.style("opacity", 0);

		stats = d3.select("#pane-2")
			.append("div")
			.attr("class", "stats")
			.html("<h3>Click on a zip code bubble to view demographic statistics for the area...</h3>")

The last thing we do in `init()` is define the hover and click functions for the bubbles. Following the same convention used for the other items, we assign everything (including demographic data) that isn't a function of the window size, saving those properties for the `render()` function. With all of the initialization actions called, we end the function by calling `render()` to complete the initial rendering of our visualization.

	bubbles.on("mouseover", function(d) {
		tooltip.transition()
			.duration(500)
			.style("opacity", .7);
		var tip = "<strong>Zip Code:</strong> " + d.Zipcode + "<br/>";
		tip = tip + "<strong>Profit:</strong> $" + d3.format(",.0f")(d.Profit);
		tooltip.html(tip)
			.style("left", (d3.event.pageX) + "px")
			.style("top", (d3.event.pageY) + "px");
	})
	.on("mouseout", function(d) {
		tooltip.transition()
			.duration(500)
			.style("opacity", 0);
	})
	.on("click", function(d) {
		var activeClass = "active";
		var alreadyIsActive = d3.select(this).classed(activeClass);
		svg.selectAll(".bubble")
			.classed(activeClass, false);
		d3.select(this).classed(activeClass, !alreadyIsActive);
		var stat;
		if (alreadyIsActive == false) {
			stat = "<div class='stat'>Zipcode<h2>" + d.Zipcode + "</h2></div>";
			stat = stat + "<div class='stat'>Profit<h2>$" + d3.format(",.0f")(d.Profit) + "</h2></div>";
			stat = stat + "<div class='stat'>Population<h2>" + d3.format(",.0f")(d.Population) + "</h2></div>";
			stat = stat + "<div class='stat'>Race (White)<h2>" + d3.format(",.1f")(d['Race-White']) + "%</h2></div>";
			stat = stat + "<div class='stat'>Median Age<h2>" + d3.format(",.1f")(d['Median-Age']) +  "</h2></div>";
			stat = stat + "<div class='stat'>Median Household Income<h2>$" + d3.format(",.0f")(d['Median-Household-Income']) + "</h2></div>";
			stat = stat + "<div class='stat'>Bachelors Degree (Adults 25+)<h2>" + d3.format(",.1f")(d['Bachelors-Degree']) + "%</h2></div>";
			stat = stat + "<div class='stat'>Graduate Degree (Adults 25+)<h2>" + d3.format(",.1f")(d['Graduate-Degree']) + "%</h2></div>";
		} else {
			stat = "<h3>Click on a zip code bubble to view demographic statistics for the area...</h3>";
		}
		stats.html(stat);
	});

	render();

Since the first thing we do in the `render()` function is call `updateDimensions()`, I'll show that first. It simply calls a function to read the width of the parent element `div#pane-1` of the map, and updates the `width` and `height` variables, accounting for padding and maintaining a fixed aspect ratio (defined here at 3:2).

	function updateDimensions() {

		var wide = getElementContentWidth('pane-1');
		padding = 10;
		width =  wide - 2 * padding;
		height = wide / 1.5 - 2 * padding;

	}

	function getElementContentWidth(element) {
		return document.getElementById(element).clientWidth;
	}

After updating the drawing dimensions, `render()` updates the bubble scaling, assigns the proper size to the `svg`, and updates the projection to the drawing size. With these items updated to scale everything properly, we're now able to assign the remaining data attributes to the paths and bubbles, which completes the process of rendering them in the drawing.

	function render() {

		updateDimensions();

		radius = d3.scale.sqrt()
			.domain([0, d3.max(csv, function(d) { return d.Profit })])
			.range([0, width/40]);

		svg
			.attr('width', width)
			.attr('height', height);

		proj
			.scale(width)
			.translate([width / 2 - padding, height / 2 - padding]);

		path
			.projection(proj);

		nation
			.attr('d', path)

		states
			.attr('d', path)

		bubbles
			.attr("cx", function (d) {
				return proj([d.Lng, d.Lat])[0];
			})
			.attr("cy", function (d) {
				return proj([d.Lng, d.Lat])[1];
			})
			.attr("r", function (d) {
				return radius(d.Profit);
			})

	}

#### Visual Styling

At this point, everything we've rendering is unstyled. We've defined the locations and sizes of elements on the page, but properties like fill color and line weight are not yet defined. While we could have done this by defining additional attributes or styles in the course of rendering, I prefer to keep styling in a separate .css file. Instead, we've assigned unique classes to elements that we can then target with style rules. For example, based on the first number of each zip code, we've assigned a corresponding class like `bubble-1` or `bubble-2` to shade bubbles based on their geographic region. Rather than laying out the entire `main.css` document, here are the first few lines that style the parent divs `div#chart`, `div.pane`, `div#pane-1`, and `div#pane-2`.

	#chart {
		max-width: 1200px;
		height: auto;
		overflow: auto;
		padding: 20px;
		background: rgb(210,210,210);;
		margin: 0 auto;
		display: block;
	}

	.pane {
		height: auto;
		overflow: auto;
		display: block;
		float: left;
		padding: 10px;
		box-sizing: border-box;
	}

	#pane-1 {
		width: 75%;
	}

	#pane-2 {
		width: 25%;
	}

If you're interested in looking through the entire `main.css` document or the full source code for everything covered in this example, you can [check it out](https://github.com/bdharva/bdharva.github.io/tree/master/assets/blog/d3-mapping-sales) on my Github.
