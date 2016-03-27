---
layout: gallery
title: Avebury Henge
category: photography
tags: Photography
thumbnail: /assets/photography/avebury/avebury-3.jpg
---

{% assign name = "avebury" %}
{% for i in (1..5) %}
[![](/assets/photography/{{ name }}/{{ name }}-{{ i }}.jpg)](/assets/photography/{{ name }}/{{ name }}-{{ i }}.jpg)
{% endfor %}