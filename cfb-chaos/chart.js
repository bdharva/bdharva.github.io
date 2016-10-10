var Chart = (function(document,window,d3) {

	var q, x, y, xconcat, yconcat, xAxis, yAxis, xLabel, yLabel, line, lines, svg, chartGroup, csv, xAxisG, yAxisG, width, height, margin = {}, padding = {}, radius, files = [], median, overlay;

	var bisectWeek = d3.bisector(function(d) { return d.Week; }).left;

	q = d3.queue()
	for (i=2002; i<=2016; i++){
		q = q.defer(d3.csv, 'summary-' + i + '.csv')
	}
	q.await(init);

	function type(data) {

		fields = ['Year', 'Week', 'Games', 'RankedGames', 'RankedLosses', 'Upsets', 'HomeUpsets', 'UpsetMargin', 'CumulativeUpsets', 'CumulativeRankedLosses'];

		data.forEach(function(d) {
			for (i=0; i < fields.length; i++) {
				d[fields[i]] = +d[fields[i]];
			}
		});

		return data;

	}

	function init(error) {

		if (error) return console.error(error);

		for (var i=1; i<arguments.length; i++) {
			files[i-1] = type(arguments[i]);
		}

		xconcat = [];
		for (i=0; i<files.length; i++){
			xconcat = xconcat.concat(files[i].map(
				function(d){
					return d['Week'];
				}
			));
		}

		yconcat = [];
		for (i=0; i<files.length; i++){
			yconcat = yconcat.concat(files[i].map(
				function(d){
					return d['CumulativeUpsets'];
				}
			));
		}

		x = d3.scaleLinear()
			.domain(d3.extent(xconcat));

		y = d3.scaleLinear()
			.domain(d3.extent(yconcat))
			.nice(5);

		xAxis = d3.axisBottom();

		yAxis = d3.axisLeft();

		line = d3.line()
			.curve(d3.curveCardinal);

		svg = d3.select("#lineweeks").append("svg");

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
			.text('Cumulative Upsets');

		lines = files.length;

		for(i=0; i<files.length; i++){
			window['line-' + i] = chartGroup.append("path")
				.datum(files[i])
				.attr("class", function(d) {
					if (i+1 == files.length) {
						return "alllines specialline line-";
					} else {
						return "alllines line-" + i;
					}
				});
		}

		var hoverbox = chartGroup.append('rect')
			.attr("class", "hoverbox")
			.style("display", "none");

		var hoverline = chartGroup.append('line')
			.attr("class", "hoverline")
			.style("display", "none");

		for(i=0; i<files.length; i++){
			window['focus-' + i] = chartGroup.append("g")
				.style("display", "none")
				.attr("class", "focus focus-" + i);
		}

		for(i=0; i<files.length; i++){
			window['focus-' + i].append("circle")
				.attr("r", 4);
		}

		for(i=0; i<files.length; i++){
			window['focus-' + i].append("text")
				.attr("x", 8)
				.attr("dy", ".35em");
		}

		overlay = chartGroup.append("rect")
		  .attr("class", "overlay");

		overlay
			.on("mouseover", function() {
				hoverline.style("display", null);
				hoverbox.style("display", null);
				for(i=0; i<files.length; i++){
					window['focus-' + i].style("display", null);
				}
			})
		  .on("mouseout", function() {
				hoverline.style("display", "none");
				hoverbox.style("display", "none");
				for(i=0; i<files.length; i++){
					window['focus-' + i].style("display", "none");
				}
			})
		  .on("mousemove", mousemove);

		function mousemove() {
			var x0 = x.invert(d3.mouse(this)[0]);
			for(j=0; j<files.length; j++){
				var hoverdata = files[j],
					i = bisectWeek(hoverdata, x0, 1),
					d0 = hoverdata[i-1],
					d1 = hoverdata[i],
					d = x0 - d0["Week"] > d1["Week"] - x0 ? d1 : d0;
				window['focus-' + j].attr("transform", "translate(" + x(d["Week"]) + "," + y(d["CumulativeUpsets"]) + ")");
				if(j==files.length-1 || j==files.length-2 || j==6 || j==2){
					window['focus-' + j].select("text").text(d["Year"] + ": " + d["CumulativeUpsets"]);
				}
				if (j == 0) {
					hoverline
						.attr('x1', x(d["Week"]))
						.attr('y1', 0)
						.attr('x2', x(d["Week"]))
						.attr('y2', height-padding.bottom);
					hoverbox
						.attr('x', x(d["Week"]))
						.attr('y', 0)
						.attr('width', width-x(d["Week"]))
						.attr('height', height-padding.bottom/2)
						.attr('fill', 'white')
						.attr('opacity', 0.7);
				}
			}
		}

		render();

	}

	function render() {

		updateDimensions('chart');

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

		line
			.x(function(d) { return x(d["Week"]); })
			.y(function(d) { return y(d["CumulativeUpsets"]); });

		for(i=0; i<lines; i++){
			window['line-' + i].attr("d", line);
		}

		overlay
			.attr("width", width)
			.attr("height", height);

	}

	function updateDimensions(element) {

		margin = {top: 30, right: 80, bottom: 30, left: 80}
		padding = {top: 0, right: 0, bottom: 20, left: 20}
		var theparent = "." + element;
		var parent_width = $(theparent).width();
		width =  parent_width - (margin.left + margin.right + padding.left + padding.right);
		height = width/2;

	}

	return {

		render : render

	}

})(document,window,d3);

window.addEventListener('resize', Chart.render);
