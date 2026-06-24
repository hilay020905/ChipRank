module testbench;

reg clk, rst, dir;

wire [3:0] count;
wire [7:0] shift;
wire parity;
wire zero;
wire carry;
wire overflow;
wire [3:0] leds;

demo_system uut(
    .clk(clk),
    .rst(rst),
    .dir(dir),
    .count(count),
    .shift(shift),
    .parity(parity),
    .zero(zero),
    .carry(carry),
    .overflow(overflow),
    .leds(leds)
);

// Waveform
initial begin
    $dumpfile("sim.vcd");
    $dumpvars(0, testbench);
end

// Clock
initial begin
    clk = 0;
    forever #5 clk = ~clk;
end

// Stimulus
initial begin
    rst = 1;
    dir = 1;

    #12 rst = 0;

    // Count up
    #80;

    // Count down
    dir = 0;
    #80;

    // Count up again
    dir = 1;
    #80;

    $finish;
end

// Console
initial begin
    $display("T clk rst dir count shift parity zero carry ovf");
    $monitor("%3t %b   %b   %b    %2d   %h     %b      %b    %b     %b",
             $time, clk, rst, dir,
             count, shift, parity,
             zero, carry, overflow);
end

endmodule