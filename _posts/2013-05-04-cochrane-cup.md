---
layout: gallery
title: MIT Rowing Cochrane Cup
category: photography
tags: Photography
thumbnail: /assets/photography/cochranecup/cochrane-23.jpg
---

{% assign name = "cochranecup" %}
{% for i in (1..30) %}
[![](/assets/photography/{{ name }}/{{ name }}-{{ i }}.jpg)](/assets/photography/{{ name }}/{{ name }}-{{ i }}.jpg)
{% endfor %}