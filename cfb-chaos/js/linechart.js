var Chart = (function(document,window,d3) {

	var csv, data, years, x, y, xAxis, yAxis, xAxisG, yAxisG, xLabel, yLabel, line, width, height, margin = {}, padding = {}, svg, chartGroup, overlay, year, hoverbox, hoverline, focuses, currentweek;

	d3.queue()
		.defer(d3.csv, 'data/stats/years.csv')
		.await(init);

	function type(data) {

		data.forEach(function(d){

			d.Week = +d.Week

		});

		return data;

	}

	function init(error, csv) {

		if (error) return console.error(error);

		data = type(csv);

		years = data.columns.slice(1).map(function(id) {
			return {
				id: id,
				values: data.map(function(d) {
						return typeof d[id] == "undefined" ? null : {week: +d.Week, upsets: +d[id]};
				}).filter(function(d) { return d != null })
			};
		});
		currentweek = years[(years.length)-1].values[(years[(years.length)-1].values.length)-1].week;

		x = d3.scaleLinear()
			.domain(d3.extent(data, function(d) { return d.Week; }));

		y = d3.scaleLinear()
			.domain([
				d3.min(years, function(c) { return d3.min(c.values, function(d) { return d.upsets; }); }),
				d3.max(years, function(c) { return d3.max(c.values, function(d) { return d.upsets; }); })
			])
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

		year = chartGroup.selectAll(".year")
			.data(years)
			.enter().append("g")
				.attr("class", function(d){
					return ("year year-" + d.id);
				})
			.append("path")
				.attr("class", "line");

		hoverbox = chartGroup.append('rect')
			.attr("class", "hoverbox");

		hoverline = chartGroup.append('line')
			.attr("class", "hoverline");

		focuses = chartGroup.selectAll('.focus')
			.data(years)
			.enter().append("g")
			.attr("class", function(d){
				return ("focus focus-" + d.id);
			});

		var circles = focuses.append("circle")
			.attr("r", 4);

		var text = focuses.append("text")
			.attr("x", 8)
			.attr("dy", ".35em");

		overlay = chartGroup.append("rect")
			.attr("class", "overlay");

		overlay
			.on("mousemove", function(){
				var x0 = x.invert(d3.mouse(this)[0]);
				mousemove(x0);
			})
			.on("mouseout", function() {
				mousemove(currentweek);
			});

		render();
		mousemove(currentweek);

	}

	function mousemove(x0) {
		var hoverdata = data,
			bisect = d3.bisector(function(d) { return d.Week; }).left,
			i = bisect(hoverdata, x0, 1),
			d0 = hoverdata[i-1],
			d1 = hoverdata[i];
			if (typeof d1 == "undefined"){
				var dz = d0;
			} else {
				d = x0 - d0["Week"] > d1["Week"] - x0 ? d1 : d0;
			}
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
			.attr('opacity', 0.8);
		focuses
			.attr("transform", function(d) {
				var bisect = d3.bisector(function(d) { return d.week; }).left,
				i = bisect(d.values, x0, 1),
				d0 = d.values[i-1],
				d1 = d.values[i];
				if (typeof d1 == "undefined"){
					var dz = d0;
				} else {
					var dz = x0 - d0.week > d1.week - x0 ? d1 : d0;
				}
				return ("translate(" + x(dz.week) + "," + y(dz.upsets) + ")");
			})
			.select("text")
				.text(function(d) {
					var bisect = d3.bisector(function(d) { return d.week; }).left,
					i = bisect(d.values, x0, 1),
					d0 = d.values[i-1],
					d1 = d.values[i];
					if (typeof d1 == "undefined"){
						var dz = d0;
					} else {
						var dz = x0 - d0.week > d1.week - x0 ? d1 : d0;
					}
					return (d.id + ": " + dz.upsets);
				});
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

		line
			.x(function(d) { return x(d.week); })
			.y(function(d) { return y(d.upsets); });

		year
			.attr("d", function(d) { return line(d.values); });

		overlay
			.attr("width", width)
			.attr("height", height);

		mousemove(6);

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
