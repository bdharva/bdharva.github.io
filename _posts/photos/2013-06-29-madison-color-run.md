---
layout: gallery
title: Madison Color Run
category: photography
tags: Photography
thumbnail: /assets/photography/colorrun/colorrun-8.jpg
---

{% assign name = "colorrun" %}
{% for i in (1..11) %}
[![](/assets/photography/{{ name }}/{{ name }}-{{ i }}.jpg)](/assets/photography/{{ name }}/{{ name }}-{{ i }}.jpg)
{% endfor %}