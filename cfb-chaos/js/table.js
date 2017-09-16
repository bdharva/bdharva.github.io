var Chart = (function(document,window,d3) {

	var x, y, xAxis, yAxis, svg, chartGroup, csv, xAxisG, yAxisG, tooltip, circles, width, height, margin = {}, padding = {}, radius, agentcolor, victimcolor, line, line0, linedata = [[0,0]], xmax, ymax, table, tableheaders, tr;

	d3.queue()
		.defer(d3.csv, 'data/stats/teams.csv')
		.await(init);

	function type(data) {

		data.forEach(function(d) {
			d.Agent = +d.Agent;
			d.Victim = +d.Victim;
			d.AgentAttempts = +d.AgentAttempts;
			d.VictimAttempts = +d.VictimAttempts;
			d.AgentPercent = d.Agent/d.AgentAttempts;
			if (d.VictimAttempts > 0) {
				d.VictimPercent = (d.VictimAttempts-d.Victim)/d.VictimAttempts;
			} else {
				d.VictimPercent = 0;
			}
			d.Margin = d.Agent - d.Victim;
			d.Image = d.Team.replace(/\s+/g, '').toLowerCase();
			d.Percentage = (d.Victim+d.Agent)/(d.AgentAttempts + d.VictimAttempts);
		});

		return data;

	}

	function init(error, csv) {

		if (error) return console.error(error);

		data = type(csv);

		agentcolor = d3.scaleLinear()
			.domain([0, d3.max(data, function(d) { return d.Agent - d.Victim })])
			.range([d3.rgb("rgb(245,245,245)"), d3.rgb('rgb(50,200,100)')])
			.interpolate(d3.interpolateRgb);

		victimcolor = d3.scaleLinear()
			.domain([0, d3.max(data, function(d) { return d.Victim - d.Agent })])
			.range([d3.rgb("rgb(245,245,245)"), d3.rgb('rgb(240,40,40)')])
			.interpolate(d3.interpolateRgb);

		table = d3.select("#tableteams").append("table").attr('id', 'datatable');

		var headers = ['Team', 'Agent', 'AgentPercent', 'Victim', 'VictimPercent', 'Margin']

		tableheaders = table.append('thead')
			.append('tr')
			.selectAll('th')
				.data(headers)
			.enter()
			.append("th")
				.text(function(d) {
					if (d == "Percentage"){
						return "Chaos +/-";
					} else if (d == "AgentPercent"){
						return "W% as chaos";
					} else if (d == "VictimPercent"){
						return "W% vs chaos";
					} else {
						return d;
					}
				})
				.attr('class', function(d) {
					if (d == 'Team') {
						return 'team';
					} else if (d == 'Margin') {
						return 'number active descending';
					} else {
						return 'number';
					}
				})
				.attr('id', function(d) { return d; });

		tableheaders.on("click", function(d) {
			var activeClass = "active";
			var ascClass = "ascending";
			var desClass = "descending";
			var alreadyIsActive = d3.select(this).classed(activeClass);
			var alreadyIsAsc = d3.select(this).classed(ascClass);
			var alreadyIsDes = d3.select(this).classed(desClass);
			table.select('thead').select('tr').selectAll("th")
				.classed(activeClass, false)
				.classed(ascClass, false)
				.classed(desClass, false);
			d3.select(this).classed(activeClass, true);
			if (d == "Team") {
				d3.select(this).classed(ascClass, !alreadyIsActive || alreadyIsDes);
				d3.select(this).classed(desClass, alreadyIsAsc);
			} else {
				d3.select(this).classed(desClass, !alreadyIsActive || alreadyIsAsc);
				d3.select(this).classed(ascClass, alreadyIsDes);
			}
			var nowIsAsc = d3.select(this).classed(ascClass);
			var nowIsDes = d3.select(this).classed(desClass);
			if (nowIsDes) {
				tr.sort(function(a, b){ return d3.descending(a[d], b[d]); })
			} else if (nowIsAsc) {
				tr.sort(function(a, b){ return d3.ascending(a[d], b[d]); })
			}
		});

		tr = table.append("tbody")
			.selectAll("tr")
			.data(data)
			.enter()
			.append("tr")
			.attr('class', 'entry');

		tr
			.sort(function(a, b) { return b.Margin - a.Margin; })

		for (i=0; i<headers.length; i++){
			tr.append("th")
				.html(function(d) {
					if (headers[i] == 'Team') {
						return "<div class='logo' style=\"background-image:url('assets/logos/" + d.Image + ".png');\"></div><div class='teamdiv'>" + d[headers[i]] + "</div>";
					} else if (headers[i] == "Percentage" || headers[i] == "AgentPercent" || headers[i] == "VictimPercent"){
						return d3.format(".1%")(d[headers[i]]);
					}else {
						return d[headers[i]];
					}
				})
				.attr('class', function(d) {
					if (headers[i] == 'Team') {
						return 'team';
					} else {
						return 'number';
					}
				})
				.style('background-color', function(d){
					if (d.Victim > d.Agent && headers[i] == 'Margin'){
						return victimcolor(d.Victim - d.Agent);
					} else if (d.Victim <= d.Agent && headers[i] == 'Margin'){
						return agentcolor(d.Agent - d.Victim);
					} else {
						return 'none';
					}
				});
		}

	}

})(document,window,d3);
