---
layout: project
title: 2016 Jeep Wrangler Build
category: projects
tag: Vehicles
tagline: "Throwing time and money at my 2016 Jeep Wrangler JKU Rubicon Hard Rock to make it extra fun"
thumbnail: /assets/work/jeep_build/hero.jpg
permalink: /work/jeep-build
wip: false
---

<h2 class="center">After-Market Parts &amp; Modifications</h2>
<div class="table_wrapper">
	<table>
		<thead>
			<tr>
				<th>Part</th>
				<th>Count</th>
				<th>Added</th>
				<th>Status</th>
			</tr>
		</thead>
		<tbody>
		{% for part in site.data.jeep_parts %}
		<tr>
			<td>
				{% if part.link %}
				<a href="{{ part.link }}">
					<i class="material-icons md-18">link</i>
				</a>
				{% else %}
				<i class="material-icons md-18 md-dark md-inactive">link_off</i>
				{% endif %}
				{{ part.name }}
			</td>
			<td>{{ part.count }}</td>
			<td>{{ part.date | date: "%b %e, %Y"}}</td>
			<td><span class="{{ part.status | downcase | replace: ' ', '-' }}">{{ part.status }}</span></td>
		</tr>
		{% endfor %}
		</tbody>
	</table>
</div>