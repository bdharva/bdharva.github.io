var Chart = (function(document,window,d3) {

	var x, y, xAxis, yAxis, svg, chartGroup, csv, xAxisG, yAxisG, tooltip, circles, width, height, margin = {}, padding = {}, radius, agentcolor, victimcolor, line, line0, linedata = [[0,0]], xmax, ymax, table, tableheaders, tr;

	d3.queue()
		.defer(d3.csv, 'data/stats/teams.csv')
		.await(init);

	function type(data) {

		data.forEach(function(d) {
			d.Agent = +d.Agent;
			d.Victim = +d.Victim;
			d.Margin = d.Agent - d.Victim;
			d.Image = d.Team.replace(/\s+/g, '').toLowerCase();
			d.Percentage = d.Agent/(d.Agent + d.Victim)-.5;
		});

		return data;

	}

	function init(error, csv) {

		if (error) return console.error(error);

		data = type(csv);

		x = d3.scaleLinear()
			.domain([0, d3.max(data, function(d){
				return d['Victim'];
			})]);

		y = d3.scaleLinear()
			.domain([0, d3.max(data, function(d){
				return d['Agent'];
			})]);

		xAxis = d3.axisBottom();

		yAxis = d3.axisLeft();

		svg = d3.select("#chartteams").append("svg");

		chartGroup = svg.append("g")
			.attr('class', 'chart');

		xAxisG = chartGroup.append("g")
			.attr("class", "x axis");

		yAxisG = chartGroup.append("g")
			.attr("class", "y axis");

		xmax = d3.max(data, function(d){return d.Victim;});
		ymax = d3.max(data, function(d){return d.Agent;});

		line = d3.line();

		line0 = chartGroup.append("path")
				.datum(function(){
					points = [[0,0]];
					if (xmax > ymax) {
						points.push([ymax, ymax]);
					} else {
						points.push([xmax, xmax]);
					}
					return points;
				})
				.attr("class", 'axisline');

		tooltip = d3.select("body").append("div")
			.attr("class", "tooltip")
			.style("opacity", 0);

		agentcolor = d3.scaleLinear()
			.domain([0, d3.max(data, function(d) { return d.Agent - d.Victim })])
			.range([d3.rgb("rgb(245,245,245)"), d3.rgb('rgb(50,200,100)')])
			.interpolate(d3.interpolateRgb);

		victimcolor = d3.scaleLinear()
			.domain([0, d3.max(data, function(d) { return d.Victim - d.Agent })])
			.range([d3.rgb("rgb(245,245,245)"), d3.rgb('rgb(240,40,40)')])
			.interpolate(d3.interpolateRgb);

		circles = chartGroup.selectAll("circle")
			.data(data)
			.enter()
			.append("circle")
				.attr('fill', function(d){
					if (d.Victim > d.Agent){
						return victimcolor(d.Victim - d.Agent);
					} else {
						return agentcolor(d.Agent - d.Victim);
					}
			});

		circles.on("mouseover", function(d) {
			var matches = [];
			data.forEach(function(c) {
				if (d.Agent == c.Agent && d.Victim == c.Victim) {
					return matches.push(c);
				}
			});
			matches.sort(function(a, b){ return d3.ascending(a.Team, b.Team); })
			var content = "";
			if (matches.length > 1 && d.Margin > 0){
				content = content + "<div class='topper'>Agents of Chaos (" + d3.format("+")(d.Margin) +")</div>";
			} else if (matches.length == 1 && d.Margin > 0) {
				content = content + "<div class='topper'>Agent of Chaos (" + d3.format("+")(d.Margin) +")</div>";
			} else if (matches.length > 1 && d.Margin < 0) {
				content = content + "<div class='topper'>Victims of Chaos (" + d3.format("+")(d.Margin) +")</div>";
			} else if (matches.length == 1 && d.Margin < 0) {
				content = content + "<div class='topper'>Victim of Chaos (" + d3.format("+")(d.Margin) +")</div>";
			} else {
				content = content + "<div class='topper'>Neutral (" + d3.format("+")(d.Margin) +")</div>";
			}
			for (i=0; i < matches.length; i++){
				content = content + "<div class='teamline'><div class='logo' style=\"background-image:url('assets/logos/" + matches[i].Image + ".png');\"></div><div class='teamdiv'>" + matches[i].Team + "</div></div>"
			}
			tooltip.html(content)
			tooltip.transition()
				.duration(200)
				.style("opacity", 1)
				.style("left", (d3.event.pageX-125) + "px")
				.style("top", (d3.event.pageY-$('.tooltip').height()-30) + "px");
		})
		.on("mouseout", function(d) {
			tooltip.transition()
				.duration(500)
				.style("opacity", 0);
			});

		render();

	}

	function render() {

		updateDimensions('.charttoggle');

		radius = d3.scaleSqrt()
			.domain([0, d3.max(data, function(d) { return d.Victim + d.Agent })])
			.range([width/500, width/75]);

		svg
			.attr("width", width + margin.left + margin.right + padding.left + padding.right)
			.attr("height", height + margin.top + margin.bottom + padding.top + padding.bottom)

		chartGroup
			.attr("transform", "translate(" + margin.left + "," + margin.top + ")");

		x.range([padding.left, width]);
		y.range([height-padding.bottom, 0]);

		xAxis.scale(x);
		yAxis.scale(y);

		xAxisG
			.attr("transform", "translate(0," + height + ")")
			.call(xAxis);

		yAxisG
			.call(yAxis);

		line
			.x(function(d) { return x(d[0]); })
			.y(function(d) { return y(d[1]); });

		line0.attr("d", line);

		circles
			.attr('cx', function(d){
				return x(d["Victim"]);
			})
			.attr('cy', function(d){
				return y(d["Agent"]);
			})
			.attr('r', function(d){
				return radius(d.Victim + d.Agent);
			});

	}

	function updateDimensions(element) {

		margin = {top: 30, right: 30, bottom: 30, left: 30}
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
