---
layout: gallery
title: Hof, Svartifoss, & Vík
category: photography
tags: Photography
thumbnail: /assets/photography/iceland/svartifoss/svartifoss-2.jpg
date: 2016-07-16 12:00:00
---

{% assign name = "hof" %}
[![](/assets/photography/iceland/{{ name }}/{{ name }}-1.jpg)](/assets/photography/iceland/{{ name }}/{{ name }}-1.jpg)
{% assign name = "svartifoss" %}
{% for i in (1..4) %}
[![](/assets/photography/iceland/{{ name }}/{{ name }}-{{ i }}.jpg)](/assets/photography/iceland/{{ name }}/{{ name }}-{{ i }}.jpg)
{% endfor %}
{% assign name = "vik" %}
{% for i in (1..5) %}
[![](/assets/photography/iceland/{{ name }}/{{ name }}-{{ i }}.jpg)](/assets/photography/iceland/{{ name }}/{{ name }}-{{ i }}.jpg)
{% endfor %}