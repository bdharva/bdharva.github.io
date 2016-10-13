var Chart = (function(document,window,d3) {

	var x, y, xAxis, yAxis, xLabel, yLabel, bargroups, gamebars, rankedlossbars, upsetbars, svg, chartGroup, csv, xAxisG, yAxisG, width, height, margin = {}, padding = {}, stackedweeks, tooltip;

	d3.queue()
		.defer(d3.csv, 'data/stats/weeks.csv')
		.await(init);

	function type(data) {

		fields = ['Week', 'Games', 'RankedGames', 'RankedLosses', 'Upsets'];

		data.forEach(function(d) {
			for (i=0; i < fields.length; i++) {
				d[fields[i]] = +d[fields[i]];
			}
		});

		return data;

	}

	function init(error, csv) {

		if (error) return console.error(error);

		stackedweeks = type(csv);

		x = d3.scaleBand()
			.domain(stackedweeks.map(function(d) { return d.Week; }))
			.padding(0.1);

		y = d3.scaleLinear()
			.domain([0, d3.max(stackedweeks, function(d) { return d.Games; })])
			.nice(5);

		xAxis = d3.axisBottom();

		yAxis = d3.axisLeft();

		svg = d3.select("#barweeks").append("svg");

		chartGroup = svg.append("g");

		xAxisG = chartGroup.append("g")
			.attr("class", "x axis");

		yAxisG = chartGroup.append("g")
			.attr("class", "y axis");

		xLabel = chartGroup.append('g')
			.attr("class", "x label");;

		xLabel.append('text')
			.attr('text-anchor', 'middle')
			.text('Week');

		yLabel = chartGroup.append('g')
			.attr("class", "y label");;

		yLabel.append('text')
			.attr('text-anchor', 'middle')
			.attr('transform', 'rotate(-90)')
			.text('Games');

		gamebars = chartGroup.selectAll(".gamebar")
			.data(stackedweeks)
			.enter()
			.append("rect")
				.attr("class", "gamebar");

		rankedlossbars = chartGroup.selectAll(".rankedlossbar")
			.data(stackedweeks)
			.enter()
			.append("rect")
				.attr("class", "rankedlossbar");

		upsetbars = chartGroup.selectAll(".upsetbar")
			.data(stackedweeks)
			.enter()
			.append("rect")
				.attr("class", "upsetbar");

		tooltip = d3.select("body").append("div")
			.attr("class", "bartooltip")
			.style("opacity", 0);

		function mouseover(d){
			tooltip.transition()
				.duration(200)
				.style("opacity", 1)
				.style("left", (d3.event.pageX-125) + "px")
				.style("top", (d3.event.pageY-$('.bartooltip').height()-30) + "px");
			var content = "";
			content = content + "<div class='topper'>Week " + d.Week +"</div>";
			content = content + "<div class=\"entry\"><span class=\"number\">" + d.Games +"</span><span class=\"description\">games</span></div>";
			content = content + "<div class=\"entry\"><span class=\"number\">" + d.Upsets +"</span><span class=\"description\">upsets</span></div>";
			content = content + "<div class=\"entry\"><span class=\"number\">" + d3.format(".1%")(d.Upsets/d.Games) +"</span><span class=\"description\">chaotic</span></div>";
			tooltip.html(content);
		}

		function mouseout(){
			tooltip.transition()
				.duration(500)
				.style("opacity", 0);
		}

		function mousemove(){
			tooltip
			.style("left", (d3.event.pageX-125) + "px")
			.style("top", (d3.event.pageY-$('.bartooltip').height()-30) + "px");
		}

		gamebars.on("mouseover", function(d) {
			mouseover(d);
		})
		.on("mouseout", function() {
			mouseout();
		})
		.on("mousemove", function() {
			mousemove();
		});

		rankedlossbars.on("mouseover", function(d) {
			mouseover(d);
		})
		.on("mouseout", function() {
			mouseout();
		})
		.on("mousemove", function() {
			mousemove();
		});

		upsetbars.on("mouseover", function(d) {
			mouseover(d);
		})
		.on("mouseout", function() {
			mouseout();
		})
		.on("mousemove", function() {
			mousemove();
		});

		render();

	}

	function render() {

		updateDimensions('.charttoggle');

		svg
			.attr("width", width + margin.left + margin.right + padding.left + padding.right)
			.attr("height", height + margin.top + margin.bottom + padding.top + padding.bottom)

		chartGroup
			.attr("transform", "translate(" + margin.left + "," + margin.top + ")");

		x.range([padding.left, width-padding.left]);
		y.range([height-padding.bottom, padding.top]);

		xAxis.scale(x);
		yAxis.scale(y);

		xAxisG
			.attr("transform", "translate(0," + height + ")")
			.call(xAxis);

		yAxisG
			.call(yAxis);

		xLabel
			.attr('transform', 'translate(' + (width/2-padding.left/2) + ', ' + (height+50) + ')');

		yLabel
			.attr('transform', 'translate(' + (-50) + ', ' + (height/2-padding.bottom/2) + ')');

		gamebars
			.attr("x", function(d) { return x(d.Week); })
			.attr("y", function(d) { return y(d.Games); })
			.attr("height", function(d) { return height - y(d.Games) - padding.bottom; })
			.attr("width", x.bandwidth());

		rankedlossbars
			.attr("x", function(d) { return x(d.Week); })
			.attr("y", function(d) { return y(d.RankedLosses); })
			.attr("height", function(d) { return height - y(d.RankedLosses) - padding.bottom; })
			.attr("width", x.bandwidth());

		upsetbars
			.attr("x", function(d) { return x(d.Week); })
			.attr("y", function(d) { return y(d.Upsets); })
			.attr("height", function(d) { return height - y(d.Upsets) - padding.bottom; })
			.attr("width", x.bandwidth());

	}

	function updateDimensions(element) {

		margin = {top: 30, right: 80, bottom: 30, left: 80}
		padding = {top: 0, right: 0, bottom: 20, left: 20}
		var parent_width = $(element).width();
		width =  parent_width - (margin.left + margin.right + padding.left + padding.right);
		height = width/2;

	}

	return {

		render : render

	}

})(document,window,d3);

window.addEventListener('resize', Chart.render);
