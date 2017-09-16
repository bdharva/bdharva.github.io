var Chart = (function(document,window,d3) {

	var x, y, xAxis, yAxis, svg, chartGroup, csv, xAxisG, yAxisG, tooltip, circles, width, height, margin = {}, padding = {}, radius, agentcolor, victimcolor, line, line0, linedata = [[0,0]], xmax, ymax, table, tableheaders, tr;

	d3.queue()
		.defer(d3.csv, 'data/stats/matchups.csv')
		.await(init);

	function type(data) {

		data.forEach(function(d) {
			d.Team1Rank = +d.Team1Rank;
			d.Team2Rank = +d.Team2Rank;
			d.Team1Attempts = +d.Team1Attempts;
			d.Team2Attempts = +d.Team2Attempts;
			d.Team1Success = +d.Team1Success;
			d.Team2Success = +d.Team2Success;
			if (d.Team1Attempts <= 0) {
				d.Team1Percent = 0;
			} else if (d.Team1Agent == 'agent') {
				d.Team1Percent = d.Team1Success/d.Team1Attempts;
			} else if (d.Team1Agent == 'victim') {
				d.Team1Percent = (d.Team1Attempts-d.Team1Success)/d.Team1Attempts;
			}
			if (d.Team2Attempts <= 0) {
				d.Team2Percent = 0;
			} else if (d.Team2Agent == 'agent') {
				d.Team2Percent = d.Team2Success/d.Team2Attempts;
			} else if (d.Team2Agent == 'victim') {
				d.Team2Percent = (d.Team2Attempts-d.Team2Success)/d.Team2Attempts;
			}
			d.Team1Image = d.Team1.replace(/\s+/g, '').toLowerCase();
			d.Team2Image = d.Team2.replace(/\s+/g, '').toLowerCase();
			if (d.Team1Agent == 'victim') {
				d.Aggregate = ((1-d.Team1Percent)+d.Team2Percent)/2;
			} else {
				d.Aggregate = ((1-d.Team2Percent)+d.Team1Percent)/2;
			}
			d.Date = d3.isoParse(d.Date);
			if (d.Network == ''){
				d.Network = '--';
			}
		});

		return data;

	}

	function init(error, csv) {

		if (error) return console.error(error);

		data = type(csv);

		tr = d3.select("#matchups")
			.selectAll("div")
			.data(data)
			.enter()
			.append("div");

		tr
			.sort(function(a, b) { return b.Aggregate - a.Aggregate; })

		tr.html(function(d) {
				var output = "<div class='matchup'><span class='info'><span class='date'>" + d3.timeFormat('%a %-m/%-d')(d.Date) + "</span><span class='time'>" + d3.timeFormat('%-I:%M %p')(d.Date) + "</span><span class='network'>" + d.Network + "</span></span><div class='teams'><div class='team'><div class='logoholder'><div class='logo' style=\"background-image:url('assets/logos/" + d.Team1Image + ".png');\"></div></div>";
				output += "<span class='name'>"
				if (d.Team1Rank <= 25) {
					output += "<span class='rank'>" + d.Team1Rank + "</span>";
				}
				output += d.Team1 + "<span class='record'>(" + d.Team1Record + ")</span></span></br>";
				if (d.Team1Agent == "agent") {
					output += "<span class='metric agent'>" + d3.format("1.3f")(d.Team1Percent) + " as team chaos</span></div>";
				} else {
					output += "<span class='metric'>" + d3.format("1.3f")(d.Team1Percent) + " vs team chaos</span></div>";
				}
				output += "<div class='team'><div class='logoholder'><div class='logo' style=\"background-image:url('assets/logos/" + d.Team2Image + ".png');\"></div></div>";
				output += "<span class='name'>"
				if (d.Team2Rank <= 25) {
					output += "<span class='rank'>" + d.Team2Rank + "</span>";
				}
				output += d.Team2 + "<span class='record'>(" + d.Team2Record + ")</span></span></br>";
				if (d.Team2Agent == "agent") {
					output += "<span class='metric agent'>" + d3.format("1.3f")(d.Team2Percent) + " as team chaos</span></div>";
				} else {
					output += "<span class='metric'>" + d3.format("1.3f")(d.Team2Percent) + " vs team chaos</span></div>";
				}
				output += "</div><span class='chaosscore'>Chaos Score: " + d3.format(".1%")(d.Aggregate) + "</span></div></div>";
				return output;
			})
			.attr('class', function(d) {
				return 'matchupwrapper';
			})

	}

})(document,window,d3);
